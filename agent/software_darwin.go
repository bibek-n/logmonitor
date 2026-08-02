//go:build darwin

package main

import (
	"encoding/json"
	"os/exec"
)

// system_profiler's own JSON shape for this data type - only the fields this agent actually
// uses are declared, everything else is dropped on decode.
type spApplicationsOutput struct {
	Apps []struct {
		Name         string `json:"_name"`
		Version      string `json:"version"`
		ObtainedFrom string `json:"obtained_from"`
		LastModified string `json:"lastModified"`
		Path         string `json:"path"`
	} `json:"SPApplicationsDataType"`
}

// CollectSoftware enumerates installed applications via system_profiler, the standard
// macOS-native inventory source (covers everything under /Applications and
// ~/Applications, both App Store and non-App Store installs) - same cgo-free, shell-out
// approach as software_linux.go's dpkg-query/rpm calls, not a raw filesystem walk of
// /Applications/*.app bundles' Info.plist files (system_profiler already does that work and
// handles edge cases - broken bundles, symlinks - this agent doesn't need to reinvent).
// ObtainedFrom ("apple" | "mac_app_store" | "identified_developer" | "unidentified_developer")
// is mapped into Publisher as the closest available analog to Windows'/Linux's real
// vendor/maintainer field - macOS doesn't expose a per-app publisher string this cheaply
// without an Info.plist read per app, which wouldn't scale well across potentially hundreds
// of installed apps for a periodic snapshot (same "doesn't scale" reasoning services_linux.go
// already applies to skipping per-unit systemctl show calls).
func CollectSoftware() []SoftwareInfo {
	out, err := exec.Command("system_profiler", "SPApplicationsDataType", "-json").Output()
	if err != nil {
		return nil
	}
	var parsed spApplicationsOutput
	if err := json.Unmarshal(out, &parsed); err != nil {
		return nil
	}
	software := make([]SoftwareInfo, 0, len(parsed.Apps))
	for _, app := range parsed.Apps {
		software = append(software, SoftwareInfo{
			Name:        app.Name,
			Version:     app.Version,
			Publisher:   app.ObtainedFrom,
			InstallDate: app.LastModified,
			InstallPath: app.Path,
		})
	}
	return software
}
