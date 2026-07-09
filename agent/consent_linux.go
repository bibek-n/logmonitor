//go:build linux

package main

import "fmt"

// The `install` subcommand is Windows-specific (the .exe doubles as the installer); on
// Linux, install.sh collects consent interactively at the terminal and then calls
// `agent enroll --consent-accepted` directly, so `agent install` isn't a supported path
// here — this stub exists only so the shared main.go compiles on both platforms.
func ShowConsentDialog() bool {
	fmt.Println("`install` is Windows-only. On Linux, use install.sh, which handles consent interactively.")
	return false
}
