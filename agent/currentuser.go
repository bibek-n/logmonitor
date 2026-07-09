package main

import (
	"runtime"
	"strings"
)

// CurrentLoggedInUser is best-effort: the agent runs as a Windows service (LocalSystem)
// or a Linux systemd service (root), neither of which is the interactively logged-in
// desktop user — so this shells out to query the active console/session user rather
// than using the process owner (which would just report SYSTEM/root, not useful).
func CurrentLoggedInUser() string {
	if runtime.GOOS == "windows" {
		out := runOut("query", "user")
		for _, line := range strings.Split(out, "\n") {
			line = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(line), ">"))
			if line == "" || strings.HasPrefix(strings.ToUpper(line), "USERNAME") {
				continue
			}
			fields := strings.Fields(line)
			if len(fields) > 0 {
				return fields[0]
			}
		}
		return ""
	}

	out := runOut("who")
	for _, line := range strings.Split(out, "\n") {
		fields := strings.Fields(line)
		if len(fields) > 0 {
			return fields[0]
		}
	}
	return ""
}
