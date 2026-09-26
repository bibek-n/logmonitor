package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

// runPowerShellDiag runs a script like runPowerShellScript (temp .ps1 via -File) but is meant for the Security & Updates
// scan/install, where "PowerShell produced nothing" must be explainable instead of a silent empty string:
//   - -ExecutionPolicy Bypass applies to this one script only; it stops a machine policy (Restricted/AllSigned, common on
//     locked-down PCs) from refusing the agent's own temp script.
//   - stdout is kept even when the exit code is non-zero, so partial results are not lost.
//   - when nothing usable comes back, diag says why (could not start, timed out, exit status + stderr).
func runPowerShellDiag(timeout time.Duration, script string) (out string, diag string) {
	tmp, err := os.CreateTemp("", "logmonitor-*.ps1")
	if err != nil {
		return "", "could not create the temporary script: " + err.Error()
	}
	defer os.Remove(tmp.Name())
	if _, err := tmp.WriteString(script); err != nil {
		tmp.Close()
		return "", "could not write the temporary script: " + err.Error()
	}
	tmp.Close()

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, "powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", tmp.Name())
	raw, err := cmd.Output()
	out = strings.TrimSpace(string(raw))
	if out != "" {
		return out, ""
	}
	if ctx.Err() == context.DeadlineExceeded {
		return "", fmt.Sprintf("timed out after %s", timeout)
	}
	if err == nil {
		return "", "PowerShell ran but printed nothing"
	}
	msg := err.Error()
	if ee, ok := err.(*exec.ExitError); ok {
		if se := strings.TrimSpace(string(ee.Stderr)); se != "" {
			msg += ": " + se
		}
	}
	return "", shortDiag(msg)
}

// shortDiag flattens a diagnostic to one line of at most 300 characters (it is stored in a warning column).
func shortDiag(s string) string {
	s = strings.Join(strings.Fields(s), " ")
	if len(s) > 300 {
		s = s[:300] + "..."
	}
	return s
}
