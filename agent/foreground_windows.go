//go:build windows

package main

import (
	"time"
	"unsafe"

	gopsprocess "github.com/shirou/gopsutil/v3/process"
	"golang.org/x/sys/windows"
)

// foregroundPollInterval matches the plan's "~10-15s poll" - fine-grained enough that a
// normal app switch is still attributed to roughly the right window, coarse enough to be a
// negligible CPU/battery cost over a full workday.
const foregroundPollInterval = 12 * time.Second

// Reuses the existing user32 LazyDLL handle already declared in
// remotesupport_input_windows.go rather than opening a second handle to the same DLL.
// kernel32 has no existing handle in this package, so that one's declared fresh here.
var (
	kernel32Foreground = windows.NewLazySystemDLL("kernel32.dll")
	procGetTickCount   = kernel32Foreground.NewProc("GetTickCount")

	procGetForegroundWindow      = user32.NewProc("GetForegroundWindow")
	procGetWindowThreadProcessId = user32.NewProc("GetWindowThreadProcessId")
	procGetLastInputInfo         = user32.NewProc("GetLastInputInfo")
	procGetWindowTextW           = user32.NewProc("GetWindowTextW")
)

// lastInputInfo mirrors the Win32 LASTINPUTINFO struct - both fields are 4 bytes and
// naturally aligned, so no manual padding is needed (unlike the INPUT union in
// remotesupport_input_windows.go).
type lastInputInfo struct {
	cbSize uint32
	dwTime uint32
}

// runForegroundPolling always runs, started once at agent startup alongside the other
// `go run...Polling(...)` calls in run.go - it does real work only while
// SetForegroundTrackingConfig has most recently marked this device enabled. That avoids the
// complexity of starting/stopping a goroutine on every heartbeat as an admin flips the
// setting; a disabled tick costs one Load() and nothing else.
func runForegroundPolling(stop <-chan struct{}) {
	ticker := time.NewTicker(foregroundPollInterval)
	defer ticker.Stop()
	lastTick := time.Now()

	for {
		select {
		case <-stop:
			return
		case now := <-ticker.C:
			elapsed := now.Sub(lastTick)
			lastTick = now
			if !foregroundEnabled.Load() {
				continue
			}
			pollForegroundOnce(int64(elapsed.Round(time.Second) / time.Second))
		}
	}
}

// pollForegroundOnce reads only: which window is foreground (→ which process owns it), how
// long since the last keyboard/mouse input system-wide, and (only if window-title
// collection is enabled) that window's title text. It never reads keystrokes, clipboard
// contents, or any other input content - GetLastInputInfo returns a single millisecond
// timestamp, nothing else, so "no keystroke/clipboard capture" holds by construction.
func pollForegroundOnce(elapsedSeconds int64) {
	hwnd, _, _ := procGetForegroundWindow.Call()
	if hwnd == 0 {
		return
	}

	var pid uint32
	procGetWindowThreadProcessId.Call(hwnd, uintptr(unsafe.Pointer(&pid)))
	if pid == 0 {
		return
	}

	name := ""
	if p, err := gopsprocess.NewProcess(int32(pid)); err == nil {
		if n, err := p.Name(); err == nil {
			name = n
		}
	}
	if name == "" || isForegroundExcluded(name) {
		return
	}

	var lii lastInputInfo
	lii.cbSize = uint32(unsafe.Sizeof(lii))
	if ok, _, _ := procGetLastInputInfo.Call(uintptr(unsafe.Pointer(&lii))); ok == 0 {
		return
	}
	nowTick, _, _ := procGetTickCount.Call()
	// Both are 32-bit tick counts (ms since boot) - unsigned subtraction is correct modulo
	// 2^32 even across a GetTickCount wraparound (~49.7 days), which idle detection at a
	// 12s poll cadence will never actually straddle.
	idleMs := int64(uint32(nowTick) - lii.dwTime)

	windowTitle := ""
	if foregroundCollectTitles.Load() {
		windowTitle = windowTextOf(hwnd)
	}

	accumulateForeground(name, elapsedSeconds, idleMs, windowTitle)
}

func windowTextOf(hwnd uintptr) string {
	buf := make([]uint16, 256)
	n, _, _ := procGetWindowTextW.Call(hwnd, uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)))
	if n == 0 {
		return ""
	}
	return windows.UTF16ToString(buf[:n])
}
