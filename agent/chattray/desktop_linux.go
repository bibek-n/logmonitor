package main

import "os"

// Many enrolled Linux targets are headless servers with no logged-in desktop session at
// all — install.sh only wires up the autostart entry when it detects one at install time,
// but this check runs again here too since a machine's desktop availability can change
// (e.g. a server rebooted without ever logging in a graphical session).
func hasDesktopSession() bool {
	return os.Getenv("DISPLAY") != "" || os.Getenv("WAYLAND_DISPLAY") != ""
}
