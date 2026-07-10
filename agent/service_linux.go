//go:build linux

package main

import (
	"fmt"
	"os"
	"os/exec"
)

// On Linux, process supervision is handled by the systemd unit written by install.sh
// (which runs `agent run` directly) — there's no separate service-registration step in
// the binary itself, unlike Windows where the .exe doubles as the installer.
func RunService() error {
	stop := make(chan struct{})
	Run(mustLoadConfig(), stop)
	return nil
}

func InstallService() error {
	return fmt.Errorf("not supported on Linux — use install.sh, which sets up the systemd unit directly")
}

// UninstallService performs a complete removal: stops + disables the systemd unit,
// deletes the unit file, reloads systemd, removes /etc/logmonitor-agent (config +
// log-shipping state), and finally unlinks the running binary itself — Linux permits
// removing an executable while it's running (the inode is reclaimed once this process
// exits), unlike Windows where the file stays locked.
func UninstallService() error {
	if err := exec.Command("systemctl", "disable", "--now", "logmonitor-agent").Run(); err != nil {
		return fmt.Errorf("failed to stop/disable the systemd unit (are you running as root?): %w", err)
	}
	_ = os.Remove("/etc/systemd/system/logmonitor-agent.service")
	_ = exec.Command("systemctl", "daemon-reload").Run()
	_ = os.RemoveAll("/etc/logmonitor-agent")

	if exePath, err := os.Executable(); err == nil {
		_ = os.Remove(exePath)
	}

	fmt.Println("LogMonitor agent stopped, disabled, and removed.")
	return nil
}

func mustLoadConfig() *Config {
	cfg, err := LoadConfig()
	if err != nil {
		panic(err)
	}
	return cfg
}
