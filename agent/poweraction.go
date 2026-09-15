package main

import (
	"os/exec"
	"runtime"
	"strings"
)

// RebootNow and ShutdownNow are only ever called from run.go after the server-issued pending
// request has already been ACKed (see client.go's AckPowerAction and the comment in
// scripts/migrate-power-actions.ts) - never call these directly without that ack having
// already succeeded. Both assume the agent process has sufficient privilege to reboot/shut
// down the machine, which is already true of every platform's install: the Windows service
// runs as LocalSystem, and the Linux/macOS service is installed to run as root (both already
// required by existing collectors like USB policy enforcement and service inventory).
func RebootNow() error {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("shutdown", "/r", "/t", "0").Run()
	case "darwin":
		return exec.Command("shutdown", "-r", "now").Run()
	default:
		return exec.Command("reboot").Run()
	}
}

func ShutdownNow() error {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("shutdown", "/s", "/t", "0").Run()
	case "darwin":
		return exec.Command("shutdown", "-h", "now").Run()
	default:
		return exec.Command("shutdown", "-h", "now").Run()
	}
}

// LogoffNow signs out whichever user(s) currently have an active session, without rebooting
// or powering off the machine - unlike Reboot/Shutdown, there's no single OS-level "log off
// the machine" command on any platform, so each branch enumerates active sessions and signs
// each one out individually.
func LogoffNow() error {
	switch runtime.GOOS {
	case "windows":
		// No direct Win32 API binding in this codebase, so this shells out to `quser` (same
		// as `query user`) and logs off every session it lists. `quser`'s columns are
		// fixed-width, not delimited - the standard PowerShell trick of collapsing runs of
		// 2+ spaces into commas before ConvertFrom-Csv reliably splits them without a
		// separate parser. Best-effort: a session whose SESSIONNAME column is blank (a
		// disconnected, not-currently-connected session) can misalign columns under this
		// heuristic - acceptable, since the common case this targets is an actively
		// logged-in interactive user, not every possible session state.
		return exec.Command("powershell", "-NoProfile", "-Command",
			`(quser) -replace '\s{2,}', ',' | ConvertFrom-Csv | ForEach-Object { logoff $_.ID }`).Run()
	case "darwin":
		// Sends the same logout Apple Event the Menu > Log Out item sends to loginwindow -
		// signs out the current console user without needing their password.
		return exec.Command("osascript", "-e", `tell application "loginwindow" to «event aevtlgof»`).Run()
	default:
		// Linux: `who` lists each logged-in user's session; loginctl (systemd-logind, already
		// relied on elsewhere in this codebase for session detection) terminates all of a
		// given user's sessions at once. Continues past a single failed terminate-user call
		// so one bad session doesn't block logging off everyone else - returns the last error
		// seen, if any, purely as a signal to the caller's log line.
		out, err := exec.Command("who").Output()
		if err != nil {
			return err
		}
		var lastErr error
		for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
			fields := strings.Fields(line)
			if len(fields) == 0 {
				continue
			}
			if err := exec.Command("loginctl", "terminate-user", fields[0]).Run(); err != nil {
				lastErr = err
			}
		}
		return lastErr
	}
}
