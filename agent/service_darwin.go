//go:build darwin

package main

import (
	"fmt"
	"os"
	"os/exec"
)

const macLaunchDaemonPlist = "/Library/LaunchDaemons/com.logmonitor.agent.plist"
const macLaunchDaemonLabel = "com.logmonitor.agent"

// Same shape as service_linux.go: on macOS, process supervision is handled by the
// LaunchDaemon plist written by install-macos.sh (which runs `agent run` directly, exactly
// like systemd's ExecStart on Linux) - there's no separate service-registration step in the
// binary itself, unlike Windows where the .exe doubles as the installer.
func RunService() error {
	stop := make(chan struct{})
	Run(mustLoadConfig(), stop)
	return nil
}

func InstallService() error {
	return fmt.Errorf("not supported on macOS — use install-macos.sh, which sets up the LaunchDaemon plist directly")
}

// UninstallService performs a complete removal: unloads + removes the LaunchDaemon plist,
// removes /etc/logmonitor-agent (config + log-shipping state), and finally unlinks the
// running binary itself - same "remove while running" semantics as Linux (POSIX reclaims the
// inode once this process exits, unlike Windows where the file stays locked).
func UninstallService() error {
	if err := exec.Command("launchctl", "bootout", "system/"+macLaunchDaemonLabel).Run(); err != nil {
		return fmt.Errorf("failed to unload the LaunchDaemon (are you running as root?): %w", err)
	}
	_ = os.Remove(macLaunchDaemonPlist)
	_ = os.RemoveAll("/etc/logmonitor-agent")
	// No-op today (see chatcompanion_darwin.go) - the per-user LaunchAgent install-macos.sh
	// writes under a specific user's home directory isn't cleaned up here, since this command
	// runs as root with no reliable way to resolve "which user" without more plumbing. A stale
	// LaunchAgent just re-launches a companion that exits immediately (no config left) - same
	// reasoning as service_linux.go's uninstallChatCompanion note.
	uninstallChatCompanion()

	if exePath, err := os.Executable(); err == nil {
		_ = os.Remove(exePath)
	}

	fmt.Println("LogMonitor agent stopped, unloaded, and removed.")
	return nil
}

// Duplicated from service_linux.go (its file name restricts it to GOOS=linux, so it isn't
// visible here) - trivial enough that sharing it isn't worth restructuring around.
func mustLoadConfig() *Config {
	cfg, err := LoadConfig()
	if err != nil {
		panic(err)
	}
	return cfg
}
