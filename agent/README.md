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

**Windows**: `agent.exe uninstall` (as administrator).
**Linux**: `sudo systemctl disable --now logmonitor-agent && sudo rm /usr/local/bin/logmonitor-agent`
