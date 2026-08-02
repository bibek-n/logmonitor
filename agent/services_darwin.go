//go:build darwin

package main

import (
	"os/exec"
	"strings"
)

// CollectServices enumerates loaded launchd jobs (daemons + agents) via `launchctl list` -
// the macOS analog of systemd units. Its output is a simple 3-column table (PID, last exit
// status, label), tab/space-separated: PID is "-" when not currently running; status is the
// last exit code, only meaningful once a job has actually exited at least once. StartupType
// and Account are left blank, same "doesn't scale well across potentially hundreds of jobs
// for a periodic snapshot" reasoning as services_linux.go's own comment on skipping a
// per-unit systemctl show call - launchctl has no cheap equivalent of systemd's
// list-unit-files enabled/disabled column in one call.
func CollectServices() []ServiceInfo {
	out, err := exec.Command("launchctl", "list").Output()
	if err != nil {
		return nil
	}

	var services []ServiceInfo
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	for i, line := range lines {
		if i == 0 && strings.HasPrefix(strings.ToUpper(line), "PID") {
			continue // header row
		}
		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}
		pid := fields[0]
		lastExit := fields[1]
		label := fields[2]

		status := "stopped"
		if pid != "-" {
			status = "running"
		} else if lastExit != "0" && lastExit != "-" {
			status = "failed"
		}

		services = append(services, ServiceInfo{
			Name:        label,
			DisplayName: label,
			Status:      status,
		})
	}
	return services
}
