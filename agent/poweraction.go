package main

import (
	"os/exec"
	"runtime"
)

// RebootNow and ShutdownNow are only ever called from run.go after the server-issued pending
// request has already been ACKed (see client.go's AckPowerAction and the comment in
// scripts/migrate-power-actions.ts) - never call these directly without that ack having
// already succeeded. Both assume the agent process has sufficient privilege to reboot/shut
// down the machine, which is already true of every platform's install: the Windows service
// runs as LocalSystem, and the Linux/macOS service is installed to run as root (both already
// required by existing collectors like USB policy enforcement and service inventory).
func RebootNow() error {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("shutdown", "/r", "/t", "0").Run()
	case "darwin":
		return exec.Command("shutdown", "-r", "now").Run()
	default:
		return exec.Command("reboot").Run()
	}
}

func ShutdownNow() error {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("shutdown", "/s", "/t", "0").Run()
	case "darwin":
		return exec.Command("shutdown", "-h", "now").Run()
	default:
		return exec.Command("shutdown", "-h", "now").Run()
	}
}
