package main

import (
	"strings"
	"testing"
)

func TestShortDiagFlattensAndCaps(t *testing.T) {
	got := shortDiag("exit status 1:\r\n  File C:\\x.ps1 cannot be loaded\n  because running scripts is disabled")
	if strings.ContainsAny(got, "\r\n") || !strings.Contains(got, "running scripts is disabled") {
		t.Errorf("not flattened: %q", got)
	}
	long := shortDiag(strings.Repeat("a ", 400))
	if len(long) > 310 || !strings.HasSuffix(long, "...") {
		t.Errorf("not capped: len=%d", len(long))
	}
}
