//go:build darwin

package main

// This binary is only ever autostarted from within an interactive macOS login session (a
// per-user LaunchAgent, loaded via launchctl in the current user's context - see
// installChatCompanion), so - same reasoning as desktop_windows.go - there's no separate
// headless-vs-desktop distinction to make here the way there is on Linux (whose XDG autostart
// mechanism install.sh mirrors can, in edge cases, still fire without a display attached).
func hasDesktopSession() bool { return true }
