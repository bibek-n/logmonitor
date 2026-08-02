//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

// installChatCompanion registers this SAME running executable ("agent.exe tray") to
// autostart at logon via a per-user Registry Run key (a Windows Service can't show a tray
// icon — see chatcompanion_run.go's package comment), then launches it immediately so it's
// live without waiting for the next logon. Used to download and launch a separate
// chattray.exe companion binary; now that the chat/notifications/remote-support companion
// mode lives in this same binary (invoked via the "tray" subcommand), there's nothing to
// download or keep version-matched anymore - one binary, one update mechanism. Best-effort
// throughout: chat is a bonus feature layered on top of the main agent, so nothing here is
// allowed to fail the overall `install` command.
func installChatCompanion() {
	exePath, err := os.Executable()
	if err != nil {
		fmt.Fprintln(os.Stderr, "warning: chat companion not installed:", err)
		return
	}

	key, _, err := registry.CreateKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Run`, registry.SET_VALUE)
	if err != nil {
		fmt.Fprintln(os.Stderr, "warning: failed to register chat companion autostart:", err)
		return
	}
	defer key.Close()
	autostartCommand := fmt.Sprintf(`"%s" tray`, exePath)
	if err := key.SetStringValue("LogMonitorChat", autostartCommand); err != nil {
		fmt.Fprintln(os.Stderr, "warning: failed to register chat companion autostart:", err)
		return
	}

	_ = exec.Command(exePath, "tray").Start()
}

// uninstallChatCompanion is the symmetric teardown, called from UninstallService(). Ends any
// running companion-mode instance first (best-effort) - matched by image name, which is now
// the SAME agent.exe as the service itself (this used to be a distinctly-named chattray.exe,
// safe to match on its own). The "SESSION ne 0" filter is what keeps this from ever touching
// the real service process instead: Windows services always run in session 0, tray-mode
// copies only ever run in a real logged-in user's interactive session - never rely on call
// order against UninstallService() stopping the service first for this same guarantee.
func uninstallChatCompanion() {
	if exePath, err := os.Executable(); err == nil {
		_ = exec.Command("taskkill", "/IM", filepath.Base(exePath), "/FI", "SESSION ne 0", "/F").Run()
	}

	key, err := registry.OpenKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Run`, registry.SET_VALUE)
	if err != nil {
		return
	}
	defer key.Close()
	_ = key.DeleteValue("LogMonitorChat")
}
