//go:build windows

package main

import (
	"unsafe"

	"testing"
)

// SendInput is a raw Win32 syscall - if rawInput's hand-rolled layout ever drifted from the
// real INPUT struct (40 bytes on amd64: 4-byte type + 4-byte pad + 32-byte union), the call
// would silently read garbage instead of failing loudly. This pins that invariant.
func TestRawInputMatchesWin32ABI(t *testing.T) {
	if got := unsafe.Sizeof(rawInput{}); got != 40 {
		t.Fatalf("rawInput size = %d, want 40 (Win32 INPUT struct size on amd64)", got)
	}
}

func TestMouseAndKeybdInputFitInUnion(t *testing.T) {
	if got := unsafe.Sizeof(mouseInputData{}); got > 32 {
		t.Fatalf("mouseInputData size = %d, exceeds the 32-byte union", got)
	}
	if got := unsafe.Sizeof(keybdInputData{}); got > 32 {
		t.Fatalf("keybdInputData size = %d, exceeds the 32-byte union", got)
	}
}

func TestHasPermission(t *testing.T) {
	cases := []struct {
		granted string
		want    string
		expect  bool
	}{
		{"view", "control", false},
		{"view,control", "control", true},
		{"control", "control", true},
		{"view, control", "control", true},
		{"", "control", false},
	}
	for _, c := range cases {
		if got := hasPermission(c.granted, c.want); got != c.expect {
			t.Errorf("hasPermission(%q, %q) = %v, want %v", c.granted, c.want, got, c.expect)
		}
	}
}
