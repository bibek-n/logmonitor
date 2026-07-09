//go:build linux

package main

import (
	"os/exec"
	"strconv"
	"strings"
)

func collectDpkgSoftware() []SoftwareInfo {
	out, err := exec.Command("dpkg-query", "-W", "-f=${Package}\t${Version}\t${Maintainer}\t${Installed-Size}\n").Output()
	if err != nil {
		return nil
	}
	var software []SoftwareInfo
	for _, line := range strings.Split(string(out), "\n") {
		if line == "" {
			continue
		}
		parts := strings.Split(line, "\t")
		if len(parts) < 4 {
			continue
		}
		sizeKB, _ := strconv.ParseInt(parts[3], 10, 64)
		software = append(software, SoftwareInfo{
			Name:      parts[0],
			Version:   parts[1],
			Publisher: parts[2],
			SizeMB:    sizeKB / 1024,
		})
	}
	return software
}

func collectRpmSoftware() []SoftwareInfo {
	out, err := exec.Command("rpm", "-qa", "--queryformat", "%{NAME}\t%{VERSION}-%{RELEASE}\t%{VENDOR}\t%{INSTALLTIME:date}\t%{SIZE}\n").Output()
	if err != nil {
		return nil
	}
	var software []SoftwareInfo
	for _, line := range strings.Split(string(out), "\n") {
		if line == "" {
			continue
		}
		parts := strings.Split(line, "\t")
		if len(parts) < 5 {
			continue
		}
		sizeBytes, _ := strconv.ParseInt(parts[4], 10, 64)
		software = append(software, SoftwareInfo{
			Name:        parts[0],
			Version:     parts[1],
			Publisher:   parts[2],
			InstallDate: parts[3],
			SizeMB:      sizeBytes / (1024 * 1024),
		})
	}
	return software
}

// CollectSoftware picks whichever package manager is present — Debian/Ubuntu (dpkg) or
// RHEL/Rocky (rpm), per the two Linux families this agent targets.
func CollectSoftware() []SoftwareInfo {
	if _, err := exec.LookPath("dpkg-query"); err == nil {
		return collectDpkgSoftware()
	}
	if _, err := exec.LookPath("rpm"); err == nil {
		return collectRpmSoftware()
	}
	return nil
}
