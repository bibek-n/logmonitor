//go:build linux

package main

import (
	"os/exec"
	"syscall"
)

// configureProcessGroup puts cmd in its own process group so killProcessGroup can take down
// every descendant a shell pipeline spawns - see runShell's doc comment for why this matters.
func configureProcessGroup(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

func killProcessGroup(cmd *exec.Cmd) error {
	if cmd.Process == nil {
		return nil
	}
	return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
}
