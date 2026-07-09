//go:build linux

package main

import (
	"os/exec"
	"strings"
)

// CollectServices enumerates systemd service units. Execution path/account are left
// blank on Linux (would need an extra `systemctl show` call per unit, which doesn't
// scale well across potentially hundreds of units for a periodic snapshot) — status
// and enabled/disabled state are the parts that matter most for a health overview.
func CollectServices() []ServiceInfo {
	statusOut, err := exec.Command("systemctl", "list-units", "--type=service", "--all", "--no-legend", "--plain").Output()
	if err != nil {
		return nil
	}

	enabledMap := map[string]string{}
	if enabledOut, err := exec.Command("systemctl", "list-unit-files", "--type=service", "--no-legend", "--plain").Output(); err == nil {
		for _, line := range strings.Split(string(enabledOut), "\n") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				enabledMap[fields[0]] = fields[1]
			}
		}
	}

	var out []ServiceInfo
	for _, line := range strings.Split(string(statusOut), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 4 {
			continue
		}
		name := fields[0]
		subState := fields[3] // running | dead | failed | exited | ...

		status := "unknown"
		switch subState {
		case "running":
			status = "running"
		case "dead", "exited":
			status = "stopped"
		case "failed":
			status = "failed"
		}

		out = append(out, ServiceInfo{
			Name:        name,
			DisplayName: name,
			Status:      status,
			StartupType: enabledMap[name],
		})
	}
	return out
}
