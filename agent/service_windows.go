//go:build windows

package main

import (
	"log"

	"github.com/kardianos/service"
)

var svcConfig = &service.Config{
	Name:        "LogMonitorAgent",
	DisplayName: "Log Monitor Endpoint Agent",
	Description: "Reports system metrics and (if enabled) screenshots to the Log Monitor dashboard. Requires local consent, accepted at install time.",
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
	log.Println("Service installed.")
	return s.Start()
}

func UninstallService() error {
	s, err := service.New(&program{}, svcConfig)
	if err != nil {
		return err
	}
	_ = s.Stop()
	return s.Uninstall()
}
