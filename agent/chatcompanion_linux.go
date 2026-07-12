//go:build !windows

package main

// On Linux, chat companion setup (download + XDG autostart entry, only when a desktop
// session is detected) is handled entirely by install.sh, not this binary's `install`
// subcommand — that command isn't part of the Linux enrollment flow (see cmdEnroll). These
// stubs exist only so cmdInstall's shared code still compiles for the Linux build target.
func installChatCompanion() {}

func uninstallChatCompanion() {}
