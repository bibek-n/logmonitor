//go:build !windows

package main

// On Linux, chat companion setup (download + XDG autostart entry, only when a desktop
// session is detected) is handled entirely by install.sh, not this binary's `install`
// subcommand — that command isn't part of the Linux enrollment flow (see cmdEnroll). These
// stubs exist only so cmdInstall's shared code still compiles for the Linux build target.
func installChatCompanion() {}

func uninstallChatCompanion() {}

// No-op here: Linux has no persistent tray process to restart in the first place (see
// tray_linux.go - each poll cycle just fires a one-shot beeep.Notify, nothing long-running
// keeps old in-memory code around the way Windows's tray-mode process does).
func restartChatCompanion() {}
