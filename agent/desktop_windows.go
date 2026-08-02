package main

// This binary is only ever autostarted from within an interactive Windows logon session
// (a Registry Run key), so there's no separate headless-vs-desktop distinction to make here
// the way there is on Linux.
func hasDesktopSession() bool { return true }
