//go:build legacy_win7

package main

// Windows 7 fallback: WebView2 (and the cgo toolchain webview_go needs) isn't available on
// Windows 7 and isn't a target for this build - see go.mod.win7's header comment. The native
// webview window in nativewindow_windows.go is excluded from this build via its own
// !legacy_win7 tag; this provides the same signature so tray_windows.go still compiles, backed
// by the same Chromium "--app=" mode popup this whole feature replaced on every other supported
// Windows version. This is the one deliberate, disclosed exception: Windows 7 keeps today's
// closable browser-popup behavior unchanged.
func openNativeWindow(kind, url string, width, height int, title string) {
	openBrowser(url, width, height)
}
