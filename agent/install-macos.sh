#!/usr/bin/env bash
# LogMonitor Endpoint Agent installer (macOS, 12.0 Monterey and later)
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/bibek-n/logmonitor/main/agent/install-macos.sh | sudo TOKEN=<TOKEN> SERVER_URL=<SERVER_URL> bash
#
# Compliance: this agent must only be installed on a company-owned device, with the user
# informed via written policy that monitoring is in effect. Installation will not proceed
# without consent being explicitly confirmed below.
#
# Mirrors install.sh's Linux flow closely (same TOKEN/SERVER_URL contract, same consent
# prompt, same enroll-then-service-install sequence) - the only real differences are launchd
# instead of systemd for the system service, and a per-user LaunchAgent instead of an XDG
# autostart entry for the chat companion (which, on this platform, is the same agent binary
# invoked with "tray" - see chatcompanion_run.go, no separate binary to download).
set -euo pipefail

REPO="bibek-n/logmonitor"
INSTALL_DIR="/usr/local/bin"
BINARY_NAME="logmonitor-agent"
CONFIG_DIR="/etc/logmonitor-agent"
LAUNCHD_LABEL="com.logmonitor.agent"
LAUNCHD_PLIST="/Library/LaunchDaemons/$LAUNCHD_LABEL.plist"

if [ "$(id -u)" -ne 0 ]; then
  echo "This installer must be run as root (use sudo)." >&2
  exit 1
fi

# Minimum-version gate: 12.0 Monterey. sw_vers' ProductVersion is e.g. "12.6.3" or "14.2" -
# comparing just the major version number is enough here (no feature in this agent depends on
# a specific Monterey point release).
MACOS_MAJOR="$(sw_vers -productVersion | cut -d. -f1)"
if [ "$MACOS_MAJOR" -lt 12 ]; then
  echo "This agent requires macOS 12.0 (Monterey) or later - detected $(sw_vers -productVersion)." >&2
  exit 1
fi

if [ -z "${TOKEN:-}" ] || [ -z "${SERVER_URL:-}" ]; then
  echo "TOKEN and SERVER_URL environment variables are required." >&2
  echo "Example: curl -fsSL .../install-macos.sh | sudo TOKEN=xxxx SERVER_URL=https://logs.example.com bash" >&2
  exit 1
fi

echo "============================================================"
echo " LogMonitor Endpoint Agent - Consent Required"
echo "============================================================"
echo "This will install endpoint monitoring on this device, including:"
echo "  - CPU / memory / disk / network usage reporting"
echo "  - Optional periodic or on-demand screenshot capture (disabled by default)"
echo "  - Optional browser activity summary: domain, page title, time, and category"
echo "    of work-related browsing (never full page addresses, form contents, or"
echo "    passwords) - disabled by default, enabled per device by an administrator"
echo
echo "This tool must only be installed on a company-owned device, with the"
echo "user informed via written policy that monitoring is in effect."
echo "============================================================"

if [ -t 0 ] || [ -e /dev/tty ]; then
  read -r -p "Do you consent to enable monitoring on this device? [y/N] " CONSENT < /dev/tty
else
  echo "No interactive terminal available to confirm consent — aborting." >&2
  exit 1
fi

if [ "${CONSENT,,}" != "y" ] && [ "${CONSENT,,}" != "yes" ]; then
  echo "Consent was not given — aborting installation."
  exit 1
fi

ARCH="$(uname -m)"
case "$ARCH" in
  arm64) GOARCH="arm64" ;;
  x86_64) GOARCH="amd64" ;;
  *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
esac

echo "Downloading latest agent release for darwin/$GOARCH..."
LATEST_URL="https://github.com/$REPO/releases/latest/download/logmonitor-agent-darwin-$GOARCH"
curl -fsSL "$LATEST_URL" -o "$INSTALL_DIR/$BINARY_NAME"
chmod 755 "$INSTALL_DIR/$BINARY_NAME"
xattr -d com.apple.quarantine "$INSTALL_DIR/$BINARY_NAME" 2>/dev/null || true

mkdir -p "$CONFIG_DIR"

echo "Enrolling device..."
"$INSTALL_DIR/$BINARY_NAME" enroll --token="$TOKEN" --server="$SERVER_URL" --consent-accepted

cat > "$LAUNCHD_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LAUNCHD_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$INSTALL_DIR/$BINARY_NAME</string>
    <string>run</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$CONFIG_DIR/agent.log</string>
  <key>StandardErrorPath</key>
  <string>$CONFIG_DIR/agent.log</string>
</dict>
</plist>
EOF

launchctl bootout system/"$LAUNCHD_LABEL" 2>/dev/null || true
launchctl bootstrap system "$LAUNCHD_PLIST"

# --- Chat companion (best-effort, never fails the main install) ---------------------------
# The main agent runs as a system LaunchDaemon (root, no desktop access) so it can't show a
# notification itself - the companion instead runs in the real logged-in user's own session,
# autostarted via a per-user LaunchAgent. Only installed when a real console (GUI) user is
# actually logged in - many enrolled Mac targets are Mac minis/servers with nobody logged in
# at install time.
DESKTOP_USER="${SUDO_USER:-}"
CONSOLE_USER="$(stat -f%Su /dev/console 2>/dev/null || echo "")"
if [ -z "$DESKTOP_USER" ] || [ "$DESKTOP_USER" = "root" ]; then
  DESKTOP_USER="$CONSOLE_USER"
fi

if [ -n "$DESKTOP_USER" ] && [ "$DESKTOP_USER" != "root" ] && [ "$DESKTOP_USER" = "$CONSOLE_USER" ]; then
  echo "Desktop session detected for $DESKTOP_USER - installing chat companion..."
  # No separate binary to download - the chat/notifications/remote-support companion is just
  # this same agent binary invoked with "tray" instead of "run" (see chatcompanion_run.go).
  USER_HOME=$(dscl . -read /Users/"$DESKTOP_USER" NFSHomeDirectory 2>/dev/null | awk '{print $2}')
  DESKTOP_UID=$(id -u "$DESKTOP_USER" 2>/dev/null || echo "")
  if [ -n "$USER_HOME" ] && [ -n "$DESKTOP_UID" ]; then
    AUTOSTART_DIR="$USER_HOME/Library/LaunchAgents"
    mkdir -p "$AUTOSTART_DIR"
    CHAT_LABEL="com.logmonitor.chat"
    CHAT_PLIST="$AUTOSTART_DIR/$CHAT_LABEL.plist"
    cat > "$CHAT_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$CHAT_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$INSTALL_DIR/$BINARY_NAME</string>
    <string>tray</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
</dict>
</plist>
EOF
    chown "$DESKTOP_USER":staff "$CHAT_PLIST"
    # Launch now so it's live without waiting for the next login - best-effort, depends on the
    # target user's GUI session already being bootstrapped (true whenever they're actually
    # logged in at the console, which is exactly the condition already checked above).
    launchctl bootout gui/"$DESKTOP_UID"/"$CHAT_LABEL" 2>/dev/null || true
    launchctl bootstrap gui/"$DESKTOP_UID" "$CHAT_PLIST" 2>/dev/null || \
      echo "Warning: could not start chat companion for $DESKTOP_USER now - it will start at next login instead." >&2
  fi
else
  echo "No desktop session detected - skipping chat companion (this looks like a headless/unattended Mac)."
fi

echo "Done. Check status with: launchctl print system/$LAUNCHD_LABEL"
