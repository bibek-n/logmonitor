package main

import "syscall"

// This binary is only ever autostarted from within an interactive Windows logon session
// (a Registry Run key), so there's no separate headless-vs-desktop distinction to make here
// the way there is on Linux.
func hasDesktopSession() bool { return true }

// detachConsole drops the console this process was started with. agent.exe is a console
// program, so when Task Scheduler (or the Run key) starts "agent.exe tray" in the employee's
// session, Windows gives it a console window - on Windows 11 a Windows Terminal window titled
// "C:\LogMonitorAgentgent.exe" sitting on the taskbar. Closing that window killed the tray
// (chat pop-ups and notifications stopped until the next sign-in). The tray never reads or
// writes the console (it logs to a file), so it simply lets go of it: with no client left the
// terminal window closes by itself and there is nothing for anyone to close afterwards.
// Tray mode only - the service ("run") has no console window in the first place.
func detachConsole() {
	_, _, _ = syscall.NewLazyDLL("kernel32.dll").NewProc("FreeConsole").Call()
}
