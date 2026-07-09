//go:build windows

package main

import (
	"syscall"
	"unsafe"
)

const (
	mbYesNo       = 0x00000004
	mbIconWarning = 0x00000030
	mbDefButton2  = 0x00000100 // default focus on "No"
	idYes         = 6
)

// ShowConsentDialog blocks with a native Windows message box (run interactively by
// whoever executes `agent.exe install`, per the plan — this only ever runs attended).
// Returns true only if the admin explicitly clicks "Yes".
func ShowConsentDialog() bool {
	user32 := syscall.NewLazyDLL("user32.dll")
	messageBoxW := user32.NewProc("MessageBoxW")

	title := `LogMonitor Endpoint Agent - Consent Required`
	text := "This will install endpoint monitoring on this device, including:\n\n" +
		"  - CPU / memory / disk / network usage reporting\n" +
		"  - Optional periodic or on-demand screenshot capture (disabled by default)\n\n" +
		"This tool must only be installed on a company-owned device, with the user informed\n" +
		"via written policy that monitoring is in effect.\n\n" +
		"Do you consent to enable monitoring on this device?"

	titlePtr, _ := syscall.UTF16PtrFromString(title)
	textPtr, _ := syscall.UTF16PtrFromString(text)

	ret, _, _ := messageBoxW.Call(
		0,
		uintptr(unsafe.Pointer(textPtr)),
		uintptr(unsafe.Pointer(titlePtr)),
		uintptr(mbYesNo|mbIconWarning|mbDefButton2),
	)
	return ret == idYes
}
