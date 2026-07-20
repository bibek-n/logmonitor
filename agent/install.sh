#!/usr/bin/env bash
# LogMonitor Endpoint Agent installer (Linux)
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/bibek-n/logmonitor/main/agent/install.sh | sudo TOKEN=<TOKEN> SERVER_URL=<SERVER_URL> bash
#
# Compliance: this agent must only be installed on a company-owned device, with the user
# informed via written policy that monitoring is in effect. Installation will not proceed
# without consent being explicitly confirmed below.
set -euo pipefail

REPO="bibek-n/logmonitor"
INSTALL_DIR="/usr/local/bin"
BINARY_NAME="logmonitor-agent"
CONFIG_DIR="/etc/logmonitor-agent"
SERVICE_NAME="logmonitor-agent"

if [ "$(id -u)" -ne 0 ]; then
  echo "This installer must be run as root (use sudo)." >&2
  exit 1
fi

if [ -z "${TOKEN:-}" ] || [ -z "${SERVER_URL:-}" ]; then
  echo "TOKEN and SERVER_URL environment variables are required." >&2
  echo "Example: curl -fsSL .../install.sh | sudo TOKEN=xxxx SERVER_URL=https://logs.example.com bash" >&2
  exit 1
fi

echo "============================================================"
echo " LogMonitor Endpoint Agent - Consent Required"
echo "============================================================"
echo "This will install endpoint monitoring on this device, including:"
echo "  - CPU / memory / disk / network usage reporting"
echo "  - Optional periodic or on-demand screenshot capture (disabled by default)"
echo
echo "This tool must only be installed on a company-owned device, with the"
echo "user informed via written policy that monitoring is in effect."
echo "============================================================"

# Read from /dev/tty explicitly since stdin is typically consumed by the piped script
# itself (curl ... | sudo bash) — this still works for an interactive terminal session.
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
  x86_64) GOARCH="amd64" ;;
  aarch64|arm64) GOARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
esac

echo "Downloading latest agent release for linux/$GOARCH..."
LATEST_URL="https://github.com/$REPO/releases/latest/download/logmonitor-agent-linux-$GOARCH"
curl -fsSL "$LATEST_URL" -o "$INSTALL_DIR/$BINARY_NAME"
chmod 755 "$INSTALL_DIR/$BINARY_NAME"

mkdir -p "$CONFIG_DIR"

echo "Enrolling device..."
"$INSTALL_DIR/$BINARY_NAME" enroll --token="$TOKEN" --server="$SERVER_URL" --consent-accepted

cat > "/etc/systemd/system/$SERVICE_NAME.service" <<EOF
[Unit]
Description=Log Monitor Endpoint Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=$INSTALL_DIR/$BINARY_NAME run
Restart=on-failure
RestartSec=10
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"

# --- Chat companion (best-effort, never fails the main install) ---------------------------
# The main agent runs as a systemd system unit (root, no desktop access) so it can't show a
# tray icon or notification itself — the companion instead runs in the real logged-in user's
# own session, autostarted via an XDG autostart entry. Only installed when a graphical
# session is actually detected for the invoking user (many enrolled Linux targets are
# headless servers with no desktop at all).
DESKTOP_USER="${SUDO_USER:-}"
HAS_DESKTOP=0
if [ -n "$DESKTOP_USER" ] && command -v loginctl >/dev/null 2>&1; then
  for sid in $(loginctl list-sessions --no-legend 2>/dev/null | awk -v u="$DESKTOP_USER" '$3==u {print $1}'); do
    SESSION_TYPE=$(loginctl show-session "$sid" -p Type --value 2>/dev/null || echo "")
    if [ "$SESSION_TYPE" = "x11" ] || [ "$SESSION_TYPE" = "wayland" ]; then
      HAS_DESKTOP=1
      break
    fi
  done
fi

if [ "$HAS_DESKTOP" -eq 1 ]; then
  echo "Desktop session detected for $DESKTOP_USER - installing chat companion..."
  COMPANION_URL="https://github.com/$REPO/releases/latest/download/logmonitor-chattray-linux-$GOARCH"
  if curl -fsSL "$COMPANION_URL" -o "$INSTALL_DIR/logmonitor-chattray" 2>/dev/null; then
    chmod 755 "$INSTALL_DIR/logmonitor-chattray"
    USER_HOME=$(getent passwd "$DESKTOP_USER" | cut -d: -f6)
    if [ -n "$USER_HOME" ]; then
      AUTOSTART_DIR="$USER_HOME/.config/autostart"
      mkdir -p "$AUTOSTART_DIR"
      cat > "$AUTOSTART_DIR/logmonitor-chat.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=LogMonitor Chat
Exec=$INSTALL_DIR/logmonitor-chattray
X-GNOME-Autostart-enabled=true
NoDisplay=false
EOF
      chown -R "$DESKTOP_USER":"$DESKTOP_USER" "$AUTOSTART_DIR/logmonitor-chat.desktop"
      # Launch now so it's live without waiting for the next login — best-effort, depends on
      # this root shell being able to reach the user's session bus/display.
      sudo -u "$DESKTOP_USER" DISPLAY="${DISPLAY:-:0}" "$INSTALL_DIR/logmonitor-chattray" >/dev/null 2>&1 &
    fi
  else
    echo "Warning: could not download chat companion - skipping (main agent install still succeeded)." >&2
  fi
else
  echo "No desktop session detected - skipping chat companion (this looks like a headless server)."
fi

echo "Done. Check status with: systemctl status $SERVICE_NAME"
