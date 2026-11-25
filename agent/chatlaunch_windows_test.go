//go:build windows

package main

import (
	"bytes"
	"errors"
	"io"
	"testing"
)

type failingWriter struct{}

func (failingWriter) Write(p []byte) (int, error) { return 0, errors.New("invalid handle") }

// Regression: with a failing stderr first in io.MultiWriter, nothing reached agent.log.
func TestBestEffortWriterKeepsFileLogging(t *testing.T) {
	var file bytes.Buffer
	w := io.MultiWriter(&file, bestEffortWriter{failingWriter{}})
	if _, err := w.Write([]byte("hello\n")); err != nil {
		t.Fatalf("write returned error: %v", err)
	}
	if file.String() != "hello\n" {
		t.Fatalf("file got %q", file.String())
	}
}

// Regression: "query user" run as SYSTEM exits 1 but still prints the session table - the
// table (with no leading ">" for a non-console caller) must still yield the active user.
func TestParseActiveSessionUsersFromSystemContext(t *testing.T) {
	out := " USERNAME              SESSIONNAME        ID  STATE   IDLE TIME  LOGON TIME\r\n" +
		" bibek                 console             1  Active       2:57  11/24/2026 3:12 PM\r\n"
	got := parseActiveSessionUsers(out)
	if len(got) != 1 || got[0] != "bibek" {
		t.Fatalf("got %v", got)
	}
}
