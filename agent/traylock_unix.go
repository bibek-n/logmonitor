//go:build !windows

package main

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
)

// PID lock file - the bug acquireTraySingleInstanceLock exists for (missing autostart
// registration on already-enrolled devices, see chatcompanion_windows.go's
// ensureChatCompanionAutostart) is Windows-specific, so this Unix version just needs to be
// correct, not as robust as the Windows named-mutex version - it exists so the shared
// runChatCompanion() entry point compiles and behaves sanely on Linux/macOS too.
func acquireTraySingleInstanceLock() bool {
	lockPath := filepath.Join(filepath.Dir(ConfigPath()), "chat-tray.lock")
	if data, err := os.ReadFile(lockPath); err == nil {
		if pid, err := strconv.Atoi(strings.TrimSpace(string(data))); err == nil && pid > 0 {
			if syscall.Kill(pid, 0) == nil {
				return false // still alive
			}
		}
	}
	_ = os.WriteFile(lockPath, []byte(strconv.Itoa(os.Getpid())), 0o644)
	return true
}
