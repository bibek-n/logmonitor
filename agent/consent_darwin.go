//go:build darwin

package main

import "fmt"

// Same reasoning as consent_linux.go: the `install` subcommand is Windows-specific (the .exe
// doubles as the installer there). On macOS, install-macos.sh collects consent interactively
// at the terminal and then calls `agent enroll --consent-accepted` directly, so `agent
// install` isn't a supported path here either - this stub exists only so the shared main.go
// compiles on every platform.
func ShowConsentDialog() bool {
	fmt.Println("`install` is Windows-only. On macOS, use install-macos.sh, which handles consent interactively.")
	return false
}
