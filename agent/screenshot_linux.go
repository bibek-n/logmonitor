//go:build linux

package main

import (
	"fmt"
	"os"
	"os/exec"
)

// CaptureScreenshot shells out to whichever common screenshot utility is available
// rather than binding to X11/Wayland directly — this keeps the agent free of cgo
// entirely (simpler cross-compilation, no build toolchain needed on the target), at the
// cost of requiring one of these tools to be installed. Capture only works when there's
// an active graphical session; a headless server has nothing to capture and this
// deliberately returns a clear error rather than silently no-op'ing.
func CaptureScreenshot() ([]byte, error) {
	tmpFile, err := os.CreateTemp("", "logmonitor-agent-*.png")
	if err != nil {
		return nil, err
	}
	tmpPath := tmpFile.Name()
	tmpFile.Close()
	defer os.Remove(tmpPath)

	candidates := [][]string{
		{"scrot", "-o", tmpPath},
		{"import", "-window", "root", tmpPath},
		{"gnome-screenshot", "-f", tmpPath},
	}

	var lastErr error
	for _, cmd := range candidates {
		if _, err := exec.LookPath(cmd[0]); err != nil {
			continue
		}
		if err := exec.Command(cmd[0], cmd[1:]...).Run(); err != nil {
			lastErr = err
			continue
		}
		data, err := os.ReadFile(tmpPath)
		if err == nil && len(data) > 0 {
			return data, nil
		}
		lastErr = err
	}

	if lastErr != nil {
		return nil, fmt.Errorf("no working screenshot tool found (tried scrot/import/gnome-screenshot): %w", lastErr)
	}
	return nil, fmt.Errorf("no screenshot tool found on this host (install scrot for headless-capable capture) — this is expected on a display-less server")
}
