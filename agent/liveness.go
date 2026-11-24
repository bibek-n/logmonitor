package main

import (
	"fmt"
	"log"
	"os"
	"sync/atomic"
	"time"
)

const (
	// heartbeatStallLimit: Client.Heartbeat is bounded (the `query user` lookup by
	// subprocessTimeout, the HTTP round trip by the client's own timeout), so an attempt that
	// hasn't completed in this long means the heartbeat loop itself is wedged, not just slow.
	// A failed attempt (network down, server unreachable) still counts as completed - this
	// only fires on a genuine hang, never on ordinary connectivity loss.
	heartbeatStallLimit = 5 * time.Minute
	// collectionStallLimit: generous on purpose. A cycle can legitimately run for minutes (the
	// first cycle after start runs every collector, CollectWindowsUpdateStatus queries the
	// Windows Update agent, CheckForUpdate downloads a release), and heartbeats keep flowing
	// while it runs anyway - this only recovers a collector that is never coming back.
	collectionStallLimit  = 30 * time.Minute
	livenessCheckInterval = 30 * time.Second
	// suspendGapThreshold: if two watchdog checks are this far apart, the machine was asleep
	// or hibernating in between (the ticker can't fire while suspended). Every timestamp the
	// watchdog compares against is then stale by the length of the sleep through no fault of
	// the agent, so it re-baselines instead of restarting the agent on every lid-open.
	suspendGapThreshold = 3 * livenessCheckInterval
)

// livenessState holds the progress stamps runLivenessWatchdog checks. Wall-clock UnixNano
// values in atomics, written by the heartbeat loop / collection worker and read by the
// watchdog goroutine.
type livenessState struct {
	lastHeartbeatAttempt atomic.Int64 // when the last Heartbeat() call returned (success or failure)
	cycleStartedAt       atomic.Int64 // when the running collection cycle started; 0 when idle
}

// livenessExit is a variable so tests can observe a watchdog-triggered exit without killing
// the test binary.
var livenessExit = func() { os.Exit(1) }

// runLivenessWatchdog restarts the agent if its heartbeat loop or collection worker stops
// making progress. Before this existed, a single call that never returned left the agent
// process running but silent: no heartbeats, the employee shown offline on the dashboard
// while their PC was plainly on the network, until someone noticed and restarted the service
// by hand (seen on two employee PCs on agent-v0.18.1 right after they switched
// networks). Exiting non-zero hands recovery to the service supervisor, the same
// mechanism update.go already relies on to restart onto a new binary: the Windows SCM via
// configureRestartOnFailure, systemd's Restart=on-failure (install.sh), launchd's KeepAlive
// (install-macos.sh).
func runLivenessWatchdog(heartbeatInterval time.Duration, s *livenessState, stop <-chan struct{}) {
	hbLimit := heartbeatStallLimit
	if l := 5 * heartbeatInterval; l > hbLimit {
		hbLimit = l // never fire before a few heartbeats could have happened at all
	}

	ticker := time.NewTicker(livenessCheckInterval)
	defer ticker.Stop()
	lastCheck := time.Now()

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			now := time.Now()
			if reason := checkLiveness(now, lastCheck, s, hbLimit, collectionStallLimit); reason != "" {
				log.Printf("watchdog: %s - exiting so the service manager restarts the agent", reason)
				livenessExit()
				return
			}
			lastCheck = now
		}
	}
}

// checkLiveness returns a non-empty reason when the agent should restart itself. On a
// suspend/resume gap it shifts every stamp forward by the gap first (so the sleep itself is
// never counted against the agent) and returns "".
func checkLiveness(now, lastCheck time.Time, s *livenessState, hbLimit, cycleLimit time.Duration) string {
	if gap := now.Sub(lastCheck); gap > suspendGapThreshold {
		shift := gap.Nanoseconds()
		s.lastHeartbeatAttempt.Add(shift)
		if started := s.cycleStartedAt.Load(); started != 0 {
			// CompareAndSwap, not Add: the worker may have just finished and stored 0, which
			// must not be turned back into a bogus non-zero start time.
			s.cycleStartedAt.CompareAndSwap(started, started+shift)
		}
		return ""
	}

	if since := now.Sub(time.Unix(0, s.lastHeartbeatAttempt.Load())); since > hbLimit {
		return fmt.Sprintf("no heartbeat attempt has completed in %s (limit %s); the heartbeat loop is hung", since.Round(time.Second), hbLimit)
	}
	if started := s.cycleStartedAt.Load(); started != 0 {
		if since := now.Sub(time.Unix(0, started)); since > cycleLimit {
			return fmt.Sprintf("a collection cycle has been running for %s (limit %s); a collector is hung", since.Round(time.Second), cycleLimit)
		}
	}
	return ""
}
