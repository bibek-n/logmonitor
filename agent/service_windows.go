//go:build windows

package main

import (
	"log"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/kardianos/service"
)

// configureRestartOnFailure tells the Windows Service Control Manager to relaunch this
// service automatically whenever it exits non-zero — which is exactly how update.go
// triggers a restart onto the newly-swapped binary (or a rolled-back one). Best-effort:
// called both at install time and on every service start, so agents installed before
// this existed self-heal without requiring a reinstall.
func configureRestartOnFailure() {
	err := exec.Command("sc", "failure", svcConfig.Name,
		"reset=", "86400",
		"actions=", "restart/5000/restart/5000/restart/5000").Run()
	if err != nil {
		log.Printf("could not configure service auto-restart (non-fatal): %v", err)
	}
}

// Arguments is the fix for "service did not respond to the start or control request in a
// timely fashion" — without it, the SCM launches the registered binary with NO arguments,
// main() hits `len(os.Args) < 2`, prints usage, and exits immediately (before ever calling
// s.Run()/program.Start()), so the SCM never sees a running-status response and times out.
// Explicitly telling the SCM to launch "agent.exe run" routes it into RunService(), which
// correctly performs the SCM handshake.
var svcConfig = &service.Config{
	Name:        "LogMonitorAgent",
	DisplayName: "Log Monitor Endpoint Agent",
	Description: "Reports system metrics and (if enabled) screenshots to the Log Monitor dashboard. Requires local consent, accepted at install time.",
	Arguments:   []string{"run"},
}

type program struct {
	stop chan struct{}
}

func (p *program) Start(s service.Service) error {
	cfg, err := LoadConfig()
	if err != nil {
		return err
	}
	p.stop = make(chan struct{})
	go Run(cfg, p.stop)
	return nil
}

func (p *program) Stop(s service.Service) error {
	close(p.stop)
	return nil
}

// RunService starts the agent under Windows Service Control Manager supervision. When
// invoked directly in a console (not via SCM), kardianos/service falls back to running
// in the foreground until interrupted — useful for testing without installing the service.
func RunService() error {
	s, err := service.New(&program{}, svcConfig)
	if err != nil {
		return err
	}
	configureRestartOnFailure()
	return s.Run()
}

// InstallService registers and starts the Windows service. The binary itself is the
// installer — there's no separate MSI.
func InstallService() error {
	s, err := service.New(&program{}, svcConfig)
	if err != nil {
		return err
	}
	if err := s.Install(); err != nil {
		return err
	}
	configureRestartOnFailure()
	log.Println("Service installed.")
	return s.Start()
}

// UninstallService stops and removes the Windows service registration, and cleans up the
// ProgramData config/log-state directory. It deliberately does NOT delete the agent.exe
// binary itself — Windows locks a running executable, so self-deletion here would be
// unreliable; the file is wherever the admin downloaded/placed it and can be removed by
// hand once this command finishes (this process needs to exit for the lock to release).
func UninstallService() error {
	s, err := service.New(&program{}, svcConfig)
	if err != nil {
		return err
	}
	_ = s.Stop()
	if err := s.Uninstall(); err != nil {
		return err
	}

	configDir := filepath.Dir(ConfigPath())
	if err := os.RemoveAll(configDir); err != nil {
		log.Printf("could not remove config directory %s (non-fatal): %v", configDir, err)
	}

	log.Println("Service uninstalled and config removed. You can now delete the agent.exe file.")
	return nil
}
