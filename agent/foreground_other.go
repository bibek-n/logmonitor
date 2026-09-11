//go:build !windows

package main

// No cross-platform, dependency-free foreground-window/idle-detection API exists for
// Linux/macOS (X11 vs. Wayland vs. Quartz all differ) - out of scope for now, mirrors the
// established no-op-stub convention (see usbpolicy_other.go). Active/idle seconds and
// window titles on a non-Windows agent simply stay zero/absent; the pre-existing
// running-duration tracking is unaffected either way.
func runForegroundPolling(stop <-chan struct{}) {
	<-stop
}
