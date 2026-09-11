package main

import (
	"bufio"
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"sync"
)

// Employee Application Activity Monitoring (Phase 3): a bounded local retry buffer for the
// process-snapshot batches that now carry active/idle-time deltas - no such thing exists
// anywhere else in this agent today, every other collector is fire-and-forget (see
// client.go's postJSON). Scoped to this one collector rather than retrofitting every
// existing one, per the plan; the shape is generic enough to reuse for a future collector.

// spoolMaxEntries bounds the file so a prolonged outage (an unplugged laptop, a firewall
// change) can't grow it without limit - oldest batches are dropped first once the cap is
// hit, since partial history beats none and an unbounded file risks filling a small system
// drive over a multi-day outage.
const spoolMaxEntries = 500

type spool struct {
	mu   sync.Mutex
	path string
}

func newSpool(name string) *spool {
	dir := filepath.Join(filepath.Dir(ConfigPath()), "spool")
	return &spool{path: filepath.Join(dir, name+".jsonl")}
}

// append adds one failed batch to the spool file, trimming from the front once it's grown
// past spoolMaxEntries.
func (s *spool) append(payload interface{}) {
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := os.MkdirAll(filepath.Dir(s.path), 0700); err != nil {
		log.Printf("spool: failed to create spool dir: %v", err)
		return
	}

	lines := s.readLinesLocked()
	lines = append(lines, string(data))
	if len(lines) > spoolMaxEntries {
		lines = lines[len(lines)-spoolMaxEntries:]
	}
	s.writeLinesLocked(lines)
}

func (s *spool) readLinesLocked() []string {
	f, err := os.Open(s.path)
	if err != nil {
		return nil
	}
	defer f.Close()

	var lines []string
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)
	for scanner.Scan() {
		if line := scanner.Text(); line != "" {
			lines = append(lines, line)
		}
	}
	return lines
}

// writeLinesLocked writes via a temp file + rename so a crash mid-save never leaves the
// real spool file half-written - os.Rename is atomic-replace on both Windows (Go uses
// MoveFileEx with MOVEFILE_REPLACE_EXISTING) and POSIX.
func (s *spool) writeLinesLocked(lines []string) {
	tmp := s.path + ".tmp"
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)
	if err != nil {
		log.Printf("spool: failed to write spool file: %v", err)
		return
	}
	w := bufio.NewWriter(f)
	for _, line := range lines {
		w.WriteString(line)
		w.WriteString("\n")
	}
	if err := w.Flush(); err != nil {
		log.Printf("spool: flush failed: %v", err)
		f.Close()
		return
	}
	f.Close()
	if err := os.Rename(tmp, s.path); err != nil {
		log.Printf("spool: rename failed: %v", err)
	}
}

// drainProcessBatches removes and returns every spooled batch, decoding each back into a
// []ProcessInfo. A malformed line (should never happen, but a partially-written file from a
// crash mid-save is possible in principle) is skipped rather than aborting the whole drain.
func (s *spool) drainProcessBatches() [][]ProcessInfo {
	s.mu.Lock()
	lines := s.readLinesLocked()
	if len(lines) > 0 {
		os.Remove(s.path)
	}
	s.mu.Unlock()

	var batches [][]ProcessInfo
	for _, line := range lines {
		var batch []ProcessInfo
		if err := json.Unmarshal([]byte(line), &batch); err != nil {
			continue
		}
		batches = append(batches, batch)
	}
	return batches
}
