# LogMonitor Endpoint Agent

Reports system metrics (CPU/RAM/disk/network/uptime) every 30 seconds and, only when
explicitly enabled per-device by an admin, captures screenshots — either on a configured
interval or on-demand via the "Screenshot now" button in the dashboard.

Monitoring only starts after local consent is given (a native dialog on Windows during
`install`, an interactive terminal prompt on Linux during `install.sh`). This agent must
only be deployed to company-owned devices, with staff informed via written policy that
monitoring is in effect — see the compliance notice on the Enroll Device admin page.

## Install

**Windows** — download the latest `agent.exe` from
[GitHub Releases](https://github.com/bibek-n/logmonitor/releases) and, as administrator:

```
agent.exe install --token=<TOKEN> --server=<SERVER_URL>
```

This shows the consent dialog, enrolls the device, and registers + starts it as a Windows
service (`LogMonitorAgent`) in one step — the `.exe` is the installer, no separate MSI.

**Linux**:

```
curl -fsSL https://raw.githubusercontent.com/bibek-n/logmonitor/main/install.sh | sudo TOKEN=<TOKEN> SERVER_URL=<SERVER_URL> bash
```

This downloads the release binary, prompts for consent at the terminal, enrolls the
device, and installs/starts a systemd unit (`logmonitor-agent.service`).

Get a `<TOKEN>` from the admin dashboard's **Enroll Device** page — each token is one-time
use and expires after 24 hours.

## Known limitations

- **Linux screenshot capture requires a graphical session.** The default systemd unit
  installed by `install.sh` runs as a root system service with no attached display, so
  `scrot`/`import`/`gnome-screenshot` will fail even if installed — this is expected on a
  headless server. To capture screenshots on a Linux desktop, run the agent as a
  **user-level** systemd unit (`systemctl --user`) inside that user's graphical session
  instead, with `DISPLAY`/`XAUTHORITY` inherited from the environment. This is a deliberate
  scope limitation of the current install script, not a bug — file an issue if you need a
  desktop-targeted install path.
- **Windows agent ships unsigned.** Until a real code-signing certificate is wired into
  the release pipeline, `agent.exe` will trigger a SmartScreen warning.
- **Uninstall has no password protection yet** (`agent.exe uninstall` runs immediately)
  — that's a planned follow-up, not implemented in this version.

## Uninstall

**Windows** (as administrator, using the same `agent.exe` you installed with):

```
agent.exe uninstall
```

Stops and removes the `LogMonitorAgent` service and deletes its config directory
(`%ProgramData%\LogMonitorAgent`). The `agent.exe` file itself is left in place — Windows
locks a running executable, so delete it by hand once the command finishes.

**Linux** (as root):

```
sudo /usr/local/bin/logmonitor-agent uninstall
```

Stops and disables the `logmonitor-agent` systemd unit, removes the unit file, reloads
systemd, deletes `/etc/logmonitor-agent` (config + log-shipping state), and removes the
binary itself. One command, nothing left behind.

If you're on an agent version older than v0.4.1, `uninstall` didn't work on Linux and
Windows service installs could fail with "service did not respond to the start or control
request in a timely fashion" — download the latest release first if you hit either of
those.
