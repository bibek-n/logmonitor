package main

import (
	"os"
	"path/filepath"
	"testing"
)

// candidateLogPaths used to guess a single hardcoded PHP-FPM log filename (php8.1-fpm.log), which
// silently missed every other PHP version - collectPhpFpmVersionLogs (glob-based) replaces that guess.
func TestCandidateLogPathsDoesNotHardcodeOnePhpVersion(t *testing.T) {
	for _, path := range candidateLogPaths()["php"] {
		if filepath.Base(path) == "php8.1-fpm.log" {
			t.Errorf("candidateLogPaths still hardcodes one PHP-FPM version (%s) - should rely on the glob instead", path)
		}
	}
}

func TestCollectPhpFpmVersionLogsFindsEveryInstalledVersion(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"php7.4-fpm.log", "php8.1-fpm.log", "php8.2-fpm.log", "not-php.log"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("[error] something went wrong\n"), 0644); err != nil {
			t.Fatal(err)
		}
	}

	old := phpFpmVersionLogGlob
	phpFpmVersionLogGlob = func() string { return filepath.Join(dir, "php*-fpm.log") }
	defer func() { phpFpmVersionLogGlob = old }()

	state := &logFileState{Offsets: map[string]int64{}}
	budget := 100
	entries := collectPhpFpmVersionLogs(state, &budget)

	if len(entries) != 3 {
		t.Fatalf("expected 3 entries (one per PHP version, excluding not-php.log), got %d: %+v", len(entries), entries)
	}
	for _, e := range entries {
		if e.Source != "php" {
			t.Errorf("entry source = %q, want %q", e.Source, "php")
		}
	}

	// Re-running with nothing new written must not re-report the same lines (offsets persisted).
	budget2 := 100
	again := collectPhpFpmVersionLogs(state, &budget2)
	if len(again) != 0 {
		t.Errorf("second call with no new lines returned %d entries, want 0", len(again))
	}
}

func TestCollectPhpFpmVersionLogsHonorsBudget(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"php7.4-fpm.log", "php8.1-fpm.log"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("line one\nline two\n"), 0644); err != nil {
			t.Fatal(err)
		}
	}
	old := phpFpmVersionLogGlob
	phpFpmVersionLogGlob = func() string { return filepath.Join(dir, "php*-fpm.log") }
	defer func() { phpFpmVersionLogGlob = old }()

	state := &logFileState{Offsets: map[string]int64{}}
	budget := 1
	entries := collectPhpFpmVersionLogs(state, &budget)
	if len(entries) != 1 {
		t.Fatalf("budget=1 should cap total entries at 1, got %d", len(entries))
	}
	if budget != 0 {
		t.Errorf("budget after collection = %d, want 0", budget)
	}
}
