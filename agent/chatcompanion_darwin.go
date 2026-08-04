//go:build darwin

package main

// Same shape as chatcompanion_linux.go: chat companion setup (per-user LaunchAgent plist,
// only when a real login session is present) is handled entirely by install-macos.sh, not
// this binary's `install` subcommand - that command isn't part of the macOS enrollment flow
// either (see cmdEnroll, and consent_darwin.go's ShowConsentDialog stub). These stubs exist
// only so cmdInstall's shared code still compiles for the darwin build target.
func installChatCompanion() {}

func uninstallChatCompanion() {}

// No-op here - same reasoning as chatcompanion_linux.go's stub: no persistent tray process
// exists on this platform to restart (see tray_darwin.go).
func restartChatCompanion() {}
