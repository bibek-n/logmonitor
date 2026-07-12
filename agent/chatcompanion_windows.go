//go:build windows

package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

func companionExePath() string {
	root := os.Getenv("ProgramData")
	if root == "" {
		root = `C:\ProgramData`
	}
	return filepath.Join(root, "LogMonitorAgent", "chattray.exe")
}

// Downloads the companion from the SAME GitHub release tag this running agent.exe itself
// was built from (AgentVersion, set at CI build time — see client.go) so the two binaries
// are always a matched pair, never "whatever happens to be latest."
func downloadCompanion() error {
	if AgentVersion == "dev" {
		return fmt.Errorf("skipping chat companion download for a local/dev build (no release tag)")
	}
	url := fmt.Sprintf("https://github.com/bibek-n/logmonitor/releases/download/%s/chattray.exe", AgentVersion)
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed: HTTP %d", resp.StatusCode)
	}

	dest := companionExePath()
	if err := os.MkdirAll(filepath.Dir(dest), 0755); err != nil {
		return err
	}
	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, resp.Body)
	return err
}

// installChatCompanion downloads the chat tray companion and registers it to autostart at
// logon via a per-user Registry Run key (a Windows Service can't show a tray icon — see the
// package comment in chattray/main.go), then launches it immediately so it's live without
// waiting for the next logon. Best-effort throughout: chat is a bonus feature layered on
// top of the main agent, so nothing here is allowed to fail the overall `install` command.
func installChatCompanion() {
	if err := downloadCompanion(); err != nil {
		fmt.Fprintln(os.Stderr, "warning: chat companion not installed:", err)
		return
	}

	key, _, err := registry.CreateKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Run`, registry.SET_VALUE)
	if err != nil {
		fmt.Fprintln(os.Stderr, "warning: failed to register chat companion autostart:", err)
		return
	}
	defer key.Close()
	if err := key.SetStringValue("LogMonitorChat", companionExePath()); err != nil {
		fmt.Fprintln(os.Stderr, "warning: failed to register chat companion autostart:", err)
		return
	}

	_ = exec.Command(companionExePath()).Start()
}

// uninstallChatCompanion is the symmetric teardown, called from UninstallService(). Ends
// any running instance first (best-effort) so it isn't holding a lock on its own exe inside
// the ProgramData directory the caller is about to remove wholesale.
func uninstallChatCompanion() {
	_ = exec.Command("taskkill", "/IM", "chattray.exe", "/F").Run()

	key, err := registry.OpenKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Run`, registry.SET_VALUE)
	if err != nil {
		return
	}
	defer key.Close()
	_ = key.DeleteValue("LogMonitorChat")
}
