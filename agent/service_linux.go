//go:build linux

package main

import "fmt"

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

func UninstallService() error {
	return fmt.Errorf("not supported on Linux — run: sudo systemctl disable --now logmonitor-agent")
}

func mustLoadConfig() *Config {
	cfg, err := LoadConfig()
	if err != nil {
		panic(err)
	}
	return cfg
}
