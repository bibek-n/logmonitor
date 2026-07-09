//go:build windows

package main

import (
	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"
)

func statusString(s svc.State) string {
	switch s {
	case svc.Running:
		return "running"
	case svc.Stopped:
		return "stopped"
	default:
		return "unknown"
	}
}

func startupTypeString(t uint32) string {
	switch t {
	case mgr.StartAutomatic:
		return "automatic"
	case mgr.StartManual:
		return "manual"
	case mgr.StartDisabled:
		return "disabled"
	default:
		return "unknown"
	}
}

// CollectServices enumerates all Windows services. Best-effort: if the SCM connection
// or an individual service query fails, that entry (or the whole list) is simply
// omitted rather than aborting the agent's other work.
func CollectServices() []ServiceInfo {
	m, err := mgr.Connect()
	if err != nil {
		return nil
	}
	defer m.Disconnect()

	names, err := m.ListServices()
	if err != nil {
		return nil
	}

	var out []ServiceInfo
	for _, name := range names {
		svcHandle, err := m.OpenService(name)
		if err != nil {
			continue
		}
		status, statusErr := svcHandle.Query()
		cfg, cfgErr := svcHandle.Config()
		svcHandle.Close()
		if statusErr != nil || cfgErr != nil {
			continue
		}
		out = append(out, ServiceInfo{
			Name:        name,
			DisplayName: cfg.DisplayName,
			Status:      statusString(status.State),
			StartupType: startupTypeString(cfg.StartType),
			ExecPath:    cfg.BinaryPathName,
			Account:     cfg.ServiceStartName,
		})
	}
	return out
}
