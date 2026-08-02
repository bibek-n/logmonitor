//go:build darwin

package main

import (
	"fmt"
	"os"
	"os/exec"
)

// CaptureScreenshot shells out to macOS's built-in screencapture utility (present on every
// Mac, no extra install needed - unlike Linux, where scrot/import/gnome-screenshot each have
// to be checked for and aren't guaranteed present) rather than binding to Core Graphics
// directly, same cgo-free reasoning as screenshot_linux.go's own comment. "-x" suppresses the
// capture sound and on-screen flash (this runs unattended); "-C" is deliberately NOT passed,
// so the cursor is never captured - matches this agent's screenshot feature not needing
// cursor position.
//
// Known limitation, not a bug: unlike Windows (screenshot_windows.go composites every
// monitor into one image) and Linux (X11's root window already is the whole multi-monitor
// desktop), a single screencapture invocation with a fixed output path only captures the
// *main* display on a multi-monitor Mac. Stitching every display into one image would need
// real image composition work and hasn't been done here - fine for the common single-display
// laptop/desktop case this feature is primarily used for, worth revisiting if multi-monitor
// Mac coverage turns out to matter.
//
// Screen Recording permission: macOS (Catalina/10.15+) requires the process actually invoking
// screencapture - which, since this runs as a LaunchDaemon under root, means the root/System
// process - to be granted Screen Recording access in System Settings > Privacy & Security.
// Without it, screencapture silently produces an all-black or all-empty image rather than
// erroring, so a captured image that's suspiciously small/blank is the diagnostic signal to
// check that permission first, not a bug in this function.
func CaptureScreenshot() ([]byte, error) {
	tmpFile, err := os.CreateTemp("", "logmonitor-agent-*.png")
	if err != nil {
		return nil, err
	}
	tmpPath := tmpFile.Name()
	tmpFile.Close()
	defer os.Remove(tmpPath)

	if err := exec.Command("screencapture", "-x", tmpPath).Run(); err != nil {
		return nil, fmt.Errorf("screencapture failed: %w", err)
	}

	data, err := os.ReadFile(tmpPath)
	if err != nil || len(data) == 0 {
		return nil, fmt.Errorf("screencapture produced no image (check Screen Recording permission under System Settings > Privacy & Security): %w", err)
	}
	return data, nil
}
