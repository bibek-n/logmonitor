//go:build windows

package main

import "golang.org/x/sys/windows/registry"

var uninstallKeyPaths = []string{
	`SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`,
	`SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall`,
}

func readSoftwareFromKey(basePath string) []SoftwareInfo {
	base, err := registry.OpenKey(registry.LOCAL_MACHINE, basePath, registry.READ)
	if err != nil {
		return nil
	}
	defer base.Close()

	names, err := base.ReadSubKeyNames(-1)
	if err != nil {
		return nil
	}

	var out []SoftwareInfo
	for _, name := range names {
		sub, err := registry.OpenKey(registry.LOCAL_MACHINE, basePath+`\`+name, registry.READ)
		if err != nil {
			continue
		}

		displayName, _, err := sub.GetStringValue("DisplayName")
		if err != nil || displayName == "" {
			sub.Close()
			continue // many subkeys are system components with no display name — skip
		}
		version, _, _ := sub.GetStringValue("DisplayVersion")
		publisher, _, _ := sub.GetStringValue("Publisher")
		installDate, _, _ := sub.GetStringValue("InstallDate")
		installLocation, _, _ := sub.GetStringValue("InstallLocation")
		sizeKB, _, _ := sub.GetIntegerValue("EstimatedSize")
		sub.Close()

		out = append(out, SoftwareInfo{
			Name:        displayName,
			Version:     version,
			Publisher:   publisher,
			InstallDate: installDate,
			InstallPath: installLocation,
			SizeMB:      int64(sizeKB) / 1024,
		})
	}
	return out
}

func CollectSoftware() []SoftwareInfo {
	var all []SoftwareInfo
	for _, path := range uninstallKeyPaths {
		all = append(all, readSoftwareFromKey(path)...)
	}
	return all
}
