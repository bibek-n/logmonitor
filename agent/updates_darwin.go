//go:build darwin

package main

import (
	"strings"
	"time"
)

// collectUpdatesPlatform reads `softwareupdate -l` (slow - it contacts Apple's servers - so it runs in the
// agent's scan goroutine with a generous timeout). Firmware on Apple silicon ships inside macOS updates.
func collectUpdatesPlatform() UpdateScan {
	s := UpdateScan{Supported: true, Complete: true, Family: "softwareupdate"}
	out := runShell(8*time.Minute, "softwareupdate -l 2>&1")
	s.Updates = parseSoftwareUpdateList(out)
	lower := strings.ToLower(out)
	if out == "" {
		s.Complete = false
		s.Warnings = append(s.Warnings, "search: softwareupdate returned no output (timed out or not permitted)")
	} else if strings.Contains(lower, "can't connect") || strings.Contains(lower, "could not connect") {
		s.Complete = false
		s.Warnings = append(s.Warnings, "search: softwareupdate could not reach Apple's update servers")
	}
	if v := runShell(10*time.Second, `defaults read /Library/Apple/System/Library/CoreServices/XProtect.bundle/Contents/Info.plist CFBundleShortVersionString 2>/dev/null`); v != "" {
		s.Definitions = &UpdateDefinitions{Name: "XProtect", Version: v}
	}
	return s
}
