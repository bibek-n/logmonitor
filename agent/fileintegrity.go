package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
)

// File Integrity Monitoring: the server tells the agent which file paths to watch (per
// device, via the heartbeat's watchedFiles field - see /api/agent/heartbeat). On every
// heartbeat this re-reads each one, hashes it, and compares against the last-known state
// persisted locally (fileIntegrityStatePath) - entirely cross-platform via the standard
// library, unlike USB detection which needs OS-specific WMI/lsblk calls.
//
// "ModifiedBy" is best-effort - CurrentLoggedInUser() (the active console/session user at
// the moment the change was *detected*, not necessarily the one who made it - there could be
// a gap between the actual edit and the next heartbeat). True forensic attribution needs
// Windows Object Access auditing (a SACL per file plus the "Audit Object Access" policy) or
// Linux auditd rules, neither of which this agent configures - that's a real limitation, not
// hidden from the admin (see the dashboard's own copy).
const maxFileIntegrityReadBytes = 5 * 1024 * 1024  // skip anything bigger - this is for configs, not logs
const maxFileIntegrityValueBytes = 100 * 1024      // captured content sent to the server, separate from the full-file hash

type fileIntegrityState struct {
	Hash    string `json:"hash"`
	Content string `json:"content"`
}

type FileIntegrityChange struct {
	FilePath   string
	ChangeType string // "Baseline", "Modified", "Deleted", "Created"
	ModifiedBy string
	OldHash    string
	NewHash    string
	OldValue   string
	NewValue   string
}

// Overridable in tests so they never read/write the real machine's state file.
var fileIntegrityStatePathOverride string

func fileIntegrityStatePath() string {
	if fileIntegrityStatePathOverride != "" {
		return fileIntegrityStatePathOverride
	}
	if runtime.GOOS == "windows" {
		root := os.Getenv("ProgramData")
		if root == "" {
			root = `C:\ProgramData`
		}
		return filepath.Join(root, "LogMonitorAgent", "file-integrity-state.json")
	}
	return "/etc/logmonitor-agent/file-integrity-state.json"
}

func loadFileIntegrityState() map[string]fileIntegrityState {
	data, err := os.ReadFile(fileIntegrityStatePath())
	if err != nil {
		return map[string]fileIntegrityState{}
	}
	var state map[string]fileIntegrityState
	if err := json.Unmarshal(data, &state); err != nil {
		return map[string]fileIntegrityState{}
	}
	return state
}

func saveFileIntegrityState(state map[string]fileIntegrityState) {
	data, err := json.Marshal(state)
	if err != nil {
		return
	}
	path := fileIntegrityStatePath()
	_ = os.MkdirAll(filepath.Dir(path), 0o755)
	_ = os.WriteFile(path, data, 0o644)
}

func hashBytes(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

func truncateForValue(b []byte) string {
	if len(b) > maxFileIntegrityValueBytes {
		return string(b[:maxFileIntegrityValueBytes]) + "\n... (truncated)"
	}
	return string(b)
}

// CheckWatchedFiles re-reads every path in `paths`, diffs against the locally persisted state
// from the previous check, and returns one FileIntegrityChange per path whose content actually
// changed (or that's being watched for the very first time - reported as "Baseline" rather
// than silently establishing a baseline with no visible record of it) or that's now missing
// (reported as "Deleted"). Unwatched paths (removed from `paths` since the last run) are
// dropped from the persisted state but never reported - watching stopped, not a file deletion.
func CheckWatchedFiles(paths []string) []FileIntegrityChange {
	prevState := loadFileIntegrityState()
	newState := map[string]fileIntegrityState{}
	var changes []FileIntegrityChange
	currentUser := CurrentLoggedInUser()

	for _, path := range paths {
		info, err := os.Stat(path)
		prev, wasWatched := prevState[path]

		if err != nil || info.IsDir() {
			// Missing (or turned into a directory, which we can't monitor content for) - only
			// worth reporting if we previously had real content for it.
			if wasWatched {
				changes = append(changes, FileIntegrityChange{
					FilePath:   path,
					ChangeType: "Deleted",
					ModifiedBy: currentUser,
					OldHash:    prev.Hash,
					OldValue:   prev.Content,
				})
			}
			continue
		}

		if info.Size() > maxFileIntegrityReadBytes {
			// Too large for a "config file" watch - keep whatever state we already had (so a
			// huge file doesn't repeatedly re-trigger "baseline" once it shrinks back down) but
			// don't attempt to read/hash it.
			if wasWatched {
				newState[path] = prev
			}
			continue
		}

		data, err := os.ReadFile(path)
		if err != nil {
			if wasWatched {
				newState[path] = prev
			}
			continue
		}

		hash := hashBytes(data)
		content := truncateForValue(data)
		newState[path] = fileIntegrityState{Hash: hash, Content: content}

		if !wasWatched {
			changes = append(changes, FileIntegrityChange{
				FilePath:   path,
				ChangeType: "Baseline",
				ModifiedBy: currentUser,
				NewHash:    hash,
				NewValue:   content,
			})
		} else if prev.Hash != hash {
			changes = append(changes, FileIntegrityChange{
				FilePath:   path,
				ChangeType: "Modified",
				ModifiedBy: currentUser,
				OldHash:    prev.Hash,
				NewHash:    hash,
				OldValue:   prev.Content,
				NewValue:   content,
			})
		}
	}

	saveFileIntegrityState(newState)
	return changes
}
