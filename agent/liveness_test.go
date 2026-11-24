package main

import (
	"strings"
	"testing"
	"time"
)

func newState(lastHB time.Time, cycleStart time.Time) *livenessState {
	s := &livenessState{}
	s.lastHeartbeatAttempt.Store(lastHB.UnixNano())
	if !cycleStart.IsZero() {
		s.cycleStartedAt.Store(cycleStart.UnixNano())
	}
	return s
}

func TestCheckLiveness(t *testing.T) {
	now := time.Now()
	recentCheck := now.Add(-livenessCheckInterval)
	hbLimit, cycleLimit := 5*time.Minute, 30*time.Minute

	cases := []struct {
		name       string
		lastHB     time.Time
		cycleStart time.Time
		lastCheck  time.Time
		wantSubstr string // "" = healthy
	}{
		{"healthy, idle", now.Add(-20 * time.Second), time.Time{}, recentCheck, ""},
		{"healthy, cycle running a few minutes", now.Add(-20 * time.Second), now.Add(-4 * time.Minute), recentCheck, ""},
		{"heartbeat loop hung", now.Add(-6 * time.Minute), time.Time{}, recentCheck, "heartbeat loop is hung"},
		{"collector hung while heartbeats continue", now.Add(-20 * time.Second), now.Add(-31 * time.Minute), recentCheck, "collector is hung"},
		// Laptop slept for an hour: every stamp is an hour old, but the watchdog's own last check
		// is too - that's a suspend, not a hang.
		{"resume from sleep is not a hang", now.Add(-61 * time.Minute), now.Add(-62 * time.Minute), now.Add(-60 * time.Minute), ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := checkLiveness(now, c.lastCheck, newState(c.lastHB, c.cycleStart), hbLimit, cycleLimit)
			if c.wantSubstr == "" && got != "" {
				t.Fatalf("expected healthy, got %q", got)
			}
			if c.wantSubstr != "" && !strings.Contains(got, c.wantSubstr) {
				t.Fatalf("expected reason containing %q, got %q", c.wantSubstr, got)
			}
		})
	}
}

// After a resume the stamps are shifted by the sleep, so the very next normal check (30s
// later) must still be healthy rather than seeing the hour-old values.
func TestCheckLivenessRebaselinesAfterResume(t *testing.T) {
	now := time.Now()
	s := newState(now.Add(-61*time.Minute), now.Add(-62*time.Minute))
	if r := checkLiveness(now, now.Add(-60*time.Minute), s, 5*time.Minute, 30*time.Minute); r != "" {
		t.Fatalf("resume check: %q", r)
	}
	next := now.Add(livenessCheckInterval)
	if r := checkLiveness(next, now, s, 5*time.Minute, 30*time.Minute); r != "" {
		t.Fatalf("first check after resume should be healthy, got %q", r)
	}
}

// A cycle that finished (stored 0) right as a resume is detected must stay idle, not be
// resurrected as a running cycle by the shift.
func TestCheckLivenessResumeKeepsIdleCycleIdle(t *testing.T) {
	now := time.Now()
	s := newState(now.Add(-61*time.Minute), time.Time{})
	checkLiveness(now, now.Add(-60*time.Minute), s, 5*time.Minute, 30*time.Minute)
	if v := s.cycleStartedAt.Load(); v != 0 {
		t.Fatalf("idle cycle became non-zero after resume shift: %d", v)
	}
}
