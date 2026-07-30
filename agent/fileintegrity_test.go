package main

import (
	"os"
	"path/filepath"
	"testing"
)

// Points fileIntegrityStatePath() at a per-test temp file instead of the real ProgramData/etc
// location, so tests never touch (or depend on) real machine state.
func withTempState(t *testing.T) {
	t.Helper()
	dir := t.TempDir()
	statePath := filepath.Join(dir, "file-integrity-state.json")
	orig := fileIntegrityStatePathOverride
	fileIntegrityStatePathOverride = statePath
	t.Cleanup(func() { fileIntegrityStatePathOverride = orig })
}

func TestCheckWatchedFiles(t *testing.T) {
	withTempState(t)
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.txt")

	if err := os.WriteFile(configPath, []byte("original content"), 0o644); err != nil {
		t.Fatal(err)
	}

	// First check: file is new to us - reported as a Baseline, not a false "Modified".
	changes := CheckWatchedFiles([]string{configPath})
	if len(changes) != 1 || changes[0].ChangeType != "Baseline" {
		t.Fatalf("expected one Baseline change, got %+v", changes)
	}
	if changes[0].NewValue != "original content" {
		t.Errorf("baseline NewValue = %q, want %q", changes[0].NewValue, "original content")
	}
	if changes[0].OldValue != "" || changes[0].OldHash != "" {
		t.Errorf("baseline should have no Old* fields, got OldValue=%q OldHash=%q", changes[0].OldValue, changes[0].OldHash)
	}

	// Second check, no change: nothing reported.
	changes = CheckWatchedFiles([]string{configPath})
	if len(changes) != 0 {
		t.Fatalf("expected no changes on unchanged file, got %+v", changes)
	}

	// Third check, content changed: reported as Modified with both old and new captured.
	if err := os.WriteFile(configPath, []byte("changed content"), 0o644); err != nil {
		t.Fatal(err)
	}
	changes = CheckWatchedFiles([]string{configPath})
	if len(changes) != 1 || changes[0].ChangeType != "Modified" {
		t.Fatalf("expected one Modified change, got %+v", changes)
	}
	if changes[0].OldValue != "original content" || changes[0].NewValue != "changed content" {
		t.Errorf("Modified OldValue/NewValue = %q/%q, want %q/%q", changes[0].OldValue, changes[0].NewValue, "original content", "changed content")
	}
	if changes[0].OldHash == changes[0].NewHash {
		t.Error("OldHash and NewHash should differ after a real content change")
	}

	// Fourth check, file removed: reported as Deleted, carrying the last known content.
	if err := os.Remove(configPath); err != nil {
		t.Fatal(err)
	}
	changes = CheckWatchedFiles([]string{configPath})
	if len(changes) != 1 || changes[0].ChangeType != "Deleted" {
		t.Fatalf("expected one Deleted change, got %+v", changes)
	}
	if changes[0].OldValue != "changed content" {
		t.Errorf("Deleted OldValue = %q, want %q", changes[0].OldValue, "changed content")
	}

	// Fifth check, still missing: no repeated Deleted event.
	changes = CheckWatchedFiles([]string{configPath})
	if len(changes) != 0 {
		t.Fatalf("expected no repeated Deleted change, got %+v", changes)
	}
}

func TestCheckWatchedFilesUnwatchedPathDropsSilently(t *testing.T) {
	withTempState(t)
	dir := t.TempDir()
	a := filepath.Join(dir, "a.txt")
	b := filepath.Join(dir, "b.txt")
	if err := os.WriteFile(a, []byte("a"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(b, []byte("b"), 0o644); err != nil {
		t.Fatal(err)
	}

	CheckWatchedFiles([]string{a, b}) // establish baselines for both

	// Admin stops watching `b` - it should never surface as a "Deleted" event just because it
	// dropped out of the watch list.
	changes := CheckWatchedFiles([]string{a})
	if len(changes) != 0 {
		t.Fatalf("expected no changes when a path is simply unwatched, got %+v", changes)
	}
}
