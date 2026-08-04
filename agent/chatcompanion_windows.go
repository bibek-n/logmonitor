//go:build windows

package main

import (
	"encoding/xml"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/sys/windows"
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

const chatAutostartTaskName = "LogMonitorChatAutostart"

// A Windows named mutex, not a PID lock file - avoids any liveness-check ambiguity (a mutex
// is automatically released by the OS the instant the owning process exits or crashes, even
// on a hard kill, so there's no stale-lock-file edge case to handle). Makes it safe for
// multiple autostart mechanisms (the Registry Run key from installChatCompanion, and the
// Scheduled Task from ensureChatCompanionAutostart below) to coexist and both try to launch
// the tray without ever producing a duplicate icon.
func acquireTraySingleInstanceLock() bool {
	name, err := windows.UTF16PtrFromString(`Global\LogMonitorChatTray`)
	if err != nil {
		return true // best-effort - never block the feature over this
	}
	_, err = windows.CreateMutex(nil, false, name)
	if err == windows.ERROR_ALREADY_EXISTS {
		return false
	}
	return true
}

// ensureChatCompanionAutostart is the self-heal fix for devices enrolled before this existed
// (or before the chat companion feature existed at all): installChatCompanion() only ever
// runs once, during the original `install`/`install-unattended` command - auto-update (see
// update.go) just swaps the binary in place and restarts the service, it never re-runs that
// one-time registration. Best-effort and called on every service start (same reasoning as
// configureRestartOnFailure in service_windows.go) so already-enrolled devices fix themselves
// without needing a reinstall.
//
// Registers a persistent Scheduled Task, triggered "at log on" for ANY interactively-logging-
// on user (principal group S-1-5-4, the well-known "INTERACTIVE" group - not a specific named
// user), which is more general than installChatCompanion()'s per-user Registry Run key (that
// one only ever covered whichever single user happened to run the installer) - this covers
// every future login going forward, for every user of a shared machine. Then, since that
// trigger only fires on the *next* login (not retroactively), separately launches the tray
// once for whoever is already logged in right now.
func ensureChatCompanionAutostart() {
	exePath, err := os.Executable()
	if err != nil {
		log.Printf("chat companion self-heal skipped (non-fatal): %v", err)
		return
	}

	if err := registerChatAutostartTask(exePath); err != nil {
		log.Printf("chat companion autostart task registration failed (non-fatal): %v", err)
	}
	launchChatCompanionForActiveSessions(exePath)
}

func xmlEscape(s string) string {
	var b strings.Builder
	if err := xml.EscapeText(&b, []byte(s)); err != nil {
		return s
	}
	return b.String()
}

func registerChatAutostartTask(exePath string) error {
	taskXML := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <GroupId>S-1-5-4</GroupId>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>%s</Command>
      <Arguments>tray</Arguments>
    </Exec>
  </Actions>
</Task>
`, xmlEscape(exePath))

	tmpFile, err := os.CreateTemp("", "logmonitor-chat-task-*.xml")
	if err != nil {
		return err
	}
	defer os.Remove(tmpFile.Name())
	if _, err := tmpFile.WriteString(taskXML); err != nil {
		tmpFile.Close()
		return err
	}
	tmpFile.Close()

	return exec.Command("schtasks", "/Create", "/TN", chatAutostartTaskName, "/XML", tmpFile.Name(), "/F").Run()
}

func launchChatCompanionForActiveSessions(exePath string) {
	out, err := exec.Command("query", "user").Output()
	if err != nil {
		// No interactive session right now (e.g. a locked/logged-off machine), or running in
		// a context "query user" can't see - nothing to do immediately; the logon task above
		// still covers the next real login.
		return
	}
	for _, user := range parseActiveSessionUsers(string(out)) {
		launchChatCompanionForUser(exePath, user)
	}
}

// query user's output is a fixed-width table:
//
//	USERNAME              SESSIONNAME        ID  STATE   IDLE TIME  LOGON TIME
//
// >bibek                 console              1  Active      none   7/30/2026 9:28 AM
//
// The current console session's username is prefixed with ">" - stripped before use. Only
// "Active" sessions are targeted, not "Disc"onnected ones - launching into a disconnected
// session either queues harmlessly or fails, and either way that session's user gets the tray
// via their own next real login regardless, so it's not worth handling specially here.
func parseActiveSessionUsers(output string) []string {
	var users []string
	lines := strings.Split(output, "\n")
	if len(lines) > 0 {
		lines = lines[1:] // skip the header row
	}
	for _, line := range lines {
		line = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(line), ">"))
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}
		isActive := false
		for _, f := range fields[1:] {
			if f == "Active" {
				isActive = true
				break
			}
			if f == "Disc" {
				break
			}
		}
		if isActive {
			users = append(users, fields[0])
		}
	}
	return users
}

// A short-lived, per-user Scheduled Task - the exact same recipe already proven to work
// manually (see the incident this was written for), just automated: schtasks' /RU + /IT
// flags are what makes Task Scheduler launch the action inside that specific user's already-
// active interactive session, which a SYSTEM-context service has no other simple way to do.
func launchChatCompanionForUser(exePath, username string) {
	taskName := "LogMonitorChatLaunch-" + username
	create := exec.Command("schtasks", "/Create", "/TN", taskName, "/TR", fmt.Sprintf(`"%s" tray`, exePath),
		"/SC", "ONCE", "/ST", "23:59", "/RU", username, "/IT", "/F")
	if err := create.Run(); err != nil {
		log.Printf("chat companion immediate launch for %s failed to schedule (non-fatal): %v", username, err)
		return
	}
	_ = exec.Command("schtasks", "/Run", "/TN", taskName).Run()
	time.AfterFunc(10*time.Second, func() {
		_ = exec.Command("schtasks", "/Delete", "/TN", taskName, "/F").Run()
	})
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
	if err == nil {
		defer key.Close()
		_ = key.DeleteValue("LogMonitorChat")
	}

	_ = exec.Command("schtasks", "/Delete", "/TN", chatAutostartTaskName, "/F").Run()
}
