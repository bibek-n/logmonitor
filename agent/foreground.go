package main

import (
	"strings"
	"sync"
	"sync/atomic"
)

// Employee Application Activity Monitoring (Phase 3): shared, cross-platform state for
// foreground-window active/idle tracking. The actual Win32 polling lives in
// foreground_windows.go (foreground_other.go no-ops on non-Windows builds, matching the
// usbpolicy_windows.go/usbpolicy_other.go split), but the accumulator and the config flags
// that gate it live here since both build variants need to read/write them the same way.
var (
	foregroundEnabled            atomic.Bool
	foregroundIdleTimeoutSeconds atomic.Int64
	foregroundCollectTitles      atomic.Bool
)

// SetForegroundTrackingConfig is called on every heartbeat (see run.go) so a device being
// opted in/out, or an idle-timeout/window-title-collection change, takes effect within one
// heartbeat interval - never read from a local config file, never requires an agent
// restart, same convention as every other heartbeat-driven feature flag in this agent.
func SetForegroundTrackingConfig(enabled bool, idleTimeoutSeconds int, collectTitles bool) {
	foregroundEnabled.Store(enabled)
	if idleTimeoutSeconds <= 0 {
		idleTimeoutSeconds = 300
	}
	foregroundIdleTimeoutSeconds.Store(int64(idleTimeoutSeconds))
	foregroundCollectTitles.Store(collectTitles)
}

var (
	foregroundExcludedMu sync.RWMutex
	foregroundExcluded   = map[string]bool{}
)

// SetForegroundExcludedProcessNames mirrors AppActivitySettings.ExcludedProcessNamesJson
// (admin-configured, distinct from the fixed OS-noise denylist in src/lib/appUsage.ts) - a
// process on this list gets no active/idle time and no window title collected at all, not
// merely filtered out of a report after the fact.
func SetForegroundExcludedProcessNames(names []string) {
	m := make(map[string]bool, len(names))
	for _, n := range names {
		m[strings.ToLower(n)] = true
	}
	foregroundExcludedMu.Lock()
	foregroundExcluded = m
	foregroundExcludedMu.Unlock()
}

func isForegroundExcluded(name string) bool {
	foregroundExcludedMu.RLock()
	defer foregroundExcludedMu.RUnlock()
	return foregroundExcluded[strings.ToLower(name)]
}

type foregroundDelta struct {
	ActiveSeconds int
	IdleSeconds   int
	WindowTitle   string
}

var (
	foregroundMu     sync.Mutex
	foregroundDeltas = map[string]*foregroundDelta{}
)

// accumulateForeground attributes one poll interval's elapsed time to processName - as
// active time if the system had recent input, idle time otherwise. windowTitle, if
// non-empty, overwrites the stored title with the most recent one seen (only the latest
// matters, unlike the seconds counters which sum).
func accumulateForeground(processName string, elapsedSeconds, idleMs int64, windowTitle string) {
	if processName == "" || elapsedSeconds <= 0 {
		return
	}
	idleTimeoutMs := foregroundIdleTimeoutSeconds.Load() * 1000

	foregroundMu.Lock()
	defer foregroundMu.Unlock()
	d, ok := foregroundDeltas[processName]
	if !ok {
		d = &foregroundDelta{}
		foregroundDeltas[processName] = d
	}
	if idleMs >= idleTimeoutMs {
		d.IdleSeconds += int(elapsedSeconds)
	} else {
		d.ActiveSeconds += int(elapsedSeconds)
	}
	if windowTitle != "" {
		d.WindowTitle = windowTitle
	}
}

// drainForegroundDeltas returns everything accumulated since the last call and resets the
// accumulator - called right before each process snapshot upload (run.go) so the deltas
// attached to that batch cover exactly the window since the previous send, matching the
// server's "delta, not cumulative total" contract (see recordAppUsageSnapshot).
func drainForegroundDeltas() map[string]*foregroundDelta {
	foregroundMu.Lock()
	defer foregroundMu.Unlock()
	out := foregroundDeltas
	foregroundDeltas = map[string]*foregroundDelta{}
	return out
}
