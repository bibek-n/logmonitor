//go:build windows

package main

import "os/exec"

// Windows shell invocations in this agent never fork long-running detached grandchildren the
// way a POSIX "sh -c 'a | b'" pipeline does (see runShell's doc comment), so there's nothing
// to group or kill here - these exist purely so the shared call sites compile on both platforms.
func configureProcessGroup(cmd *exec.Cmd) {}

func killProcessGroup(cmd *exec.Cmd) error { return nil }
