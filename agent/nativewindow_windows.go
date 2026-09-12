//go:build !legacy_win7

// WebView2 (and the cgo toolchain webview_go needs) isn't available for the Windows 7 build -
// see go.mod.win7's header comment and nativewindow_legacy_windows.go, which provides the same
// openNativeWindow signature for that build via the old Chromium app-mode popup instead.

package main

import (
	"runtime"
	"sync"

	"github.com/lxn/win"
	webview "github.com/webview/webview_go"
)

// nativeWindows tracks the currently open window's HWND for each "kind" (e.g. "chat", or a
// notification's own key) so a repeat request for the same kind brings the existing window to
// the front instead of spawning a duplicate — the singleton behavior the tamper-protection plan
// calls for, mirroring the single-instance-lock philosophy already used for the tray process
// itself (see acquireTraySingleInstanceLock in chatcompanion_windows.go).
var (
	nativeWindowsMu sync.Mutex
	nativeWindows   = map[string]win.HWND{}
)

// openNativeWindow opens a webview-backed native window with no close button — only the
// standard minimize/maximize controls remain — so nothing in the window itself lets an employee
// dismiss it (the "basic" tamper-protection tier the user asked for; a Task Manager kill of the
// whole tray process is separately covered by the run.go watchdog relaunching it).
//
// kind distinguishes independent windows that may legitimately be open at once (the chat window
// vs. a given notification popup) — a second call with the same kind refocuses the existing
// window instead of opening another. Must not be called from the tray's own message-loop thread
// (it spawns its own dedicated OS thread and does not block).
func openNativeWindow(kind, url string, width, height int, title string) {
	nativeWindowsMu.Lock()
	if hwnd, ok := nativeWindows[kind]; ok {
		nativeWindowsMu.Unlock()
		win.SetForegroundWindow(hwnd)
		return
	}
	nativeWindowsMu.Unlock()

	go func() {
		// webview's Run() drives a Win32 message loop, which — like the tray's own loop in
		// tray_windows.go — is thread-affine. This goroutine must own its OS thread for the
		// window's whole lifetime, not just at creation.
		runtime.LockOSThread()
		defer runtime.UnlockOSThread()

		w := webview.New(false)
		defer w.Destroy()

		w.SetTitle(title)
		// HintNone: resizable, not fixed. A fixed-size window can't be maximized, which would
		// make the "minimize/maximize only" requirement meaningless.
		w.SetSize(width, height, webview.HintNone)
		w.Navigate(url)

		hwnd := win.HWND(uintptr(w.Window()))
		if hMenu := win.GetSystemMenu(hwnd, false); hMenu != 0 {
			win.DeleteMenu(hMenu, win.SC_CLOSE, win.MF_BYCOMMAND)
		}

		nativeWindowsMu.Lock()
		nativeWindows[kind] = hwnd
		nativeWindowsMu.Unlock()

		w.Run() // blocks until Destroy(); with SC_CLOSE gone, nothing in the UI can trigger that

		nativeWindowsMu.Lock()
		delete(nativeWindows, kind)
		nativeWindowsMu.Unlock()
	}()
}
