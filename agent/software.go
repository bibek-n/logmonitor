package main

// SoftwareInfo omits a "license status" field on purpose — there's no generic,
// cross-platform, cross-vendor signal for license state, unlike everything else here
// which the OS genuinely exposes. Read-only inventory; no remote uninstall (deferred).
type SoftwareInfo struct {
	Name        string `json:"name"`
	Version     string `json:"version"`
	Publisher   string `json:"publisher"`
	InstallDate string `json:"installDate"`
	InstallPath string `json:"installPath"`
	SizeMB      int64  `json:"sizeMB"`
}
