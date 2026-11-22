//go:build windows

package main

import (
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/kardianos/service"
)

// setupFileLogging makes log.Printf output durable. Running under the Windows Service
// Control Manager, this process has no console - anything written to os.Stderr (the
// log package's default) simply vanishes, and nothing is ever written to the Windows
// Event Log either. That turned a real crash loop (the service panicking and being
// silently restarted by the SCM's configured recovery actions - see
// configureRestartOnFailure below) into something with zero diagnostics anywhere:
// Get-WinEvent showed nothing, because there was nothing to show. Mirrors/precedes the
// ProgramData location SaveConfig already uses. Best-effort: if the file can't be
// opened (e.g. permissions), falls back to stderr-only rather than failing startup
// over a logging problem.
func setupFileLogging() {
	dir := filepath.Dir(ConfigPath())
	if err := os.MkdirAll(dir, 0700); err != nil {
		log.Printf("could not create log directory %s (logging to stderr only): %v", dir, err)
		return
	}
	path := filepath.Join(dir, "agent.log")

	// Simple one-shot rotation rather than a full rolling scheme - this only needs to
	// survive long enough to diagnose a crash loop, not serve as a general-purpose log
	// archive. 10MB is generous for a once-per-heartbeat log line plus occasional panics.
	if info, err := os.Stat(path); err == nil && info.Size() > 10*1024*1024 {
		_ = os.Rename(path, path+".old")
	}

	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		log.Printf("could not open log file %s (logging to stderr only): %v", path, err)
		return
	}
	// Keep stderr too - console/foreground runs (agent.exe run from an interactive
	// prompt) still see output live, same as before this change.
	log.SetOutput(io.MultiWriter(os.Stderr, f))
}

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
	setupFileLogging()
	s, err := service.New(&program{}, svcConfig)
	if err != nil {
		return err
	}
	configureRestartOnFailure()
	// Backgrounded so a slow schtasks call (or several, one per logged-in user) can never
	// delay the SCM start-acknowledgment below and risk the exact timeout Arguments (further
	// up this file) already goes out of its way to avoid.
	go ensureChatCompanionAutostart()
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

	uninstallChatCompanion()

	configDir := filepath.Dir(ConfigPath())
	if err := os.RemoveAll(configDir); err != nil {
		log.Printf("could not remove config directory %s (non-fatal): %v", configDir, err)
	}

	log.Println("Service uninstalled and config removed. You can now delete the agent.exe file.")
	return nil
}
