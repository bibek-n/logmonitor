package main

import (
	"crypto/sha256"
	"encoding/hex"
	"io"
	"os"
	"sync"

	gopsprocess "github.com/shirou/gopsutil/v3/process"
)

// ProcessInfo omits a "priority" field — gopsutil has no cross-platform notion of
// process priority (Windows priority classes vs. POSIX nice values don't map cleanly),
// and "digital signature" is simplified here to a SHA256 hash of the executable, per
// the plan (full Authenticode chain validation is Windows-only and a much bigger job
// for uncertain value right now). No kill/restart — read-only inventory (deferred).
type ProcessInfo struct {
	PID        int32   `json:"pid"`
	PPID       int32   `json:"ppid"`
	Name       string  `json:"name"`
	CPUPercent float64 `json:"cpuPercent"`
	MemPercent float32 `json:"memPercent"`
	Owner      string  `json:"owner"`
	StartTime  int64   `json:"startTime"` // unix ms
	Cmdline    string  `json:"cmdline"`
	Status     string  `json:"status"`
	ExePath    string  `json:"exePath"`
	Sha256     string  `json:"sha256"`
}

type hashCacheEntry struct {
	size    int64
	modTime int64
	hash    string
}

var (
	hashCacheMu sync.Mutex
	hashCache   = map[string]hashCacheEntry{}
)

// hashExecutable hashes the target file, caching by (path, size, mtime) so a process
// that's already been hashed this run doesn't get re-read every snapshot cycle — full
// binaries can be large, and most processes are long-running between polls.
func hashExecutable(path string) string {
	if path == "" {
		return ""
	}
	stat, err := os.Stat(path)
	if err != nil {
		return ""
	}

	hashCacheMu.Lock()
	if cached, ok := hashCache[path]; ok && cached.size == stat.Size() && cached.modTime == stat.ModTime().UnixNano() {
		hashCacheMu.Unlock()
		return cached.hash
	}
	hashCacheMu.Unlock()

	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return ""
	}
	sum := hex.EncodeToString(h.Sum(nil))

	hashCacheMu.Lock()
	hashCache[path] = hashCacheEntry{size: stat.Size(), modTime: stat.ModTime().UnixNano(), hash: sum}
	hashCacheMu.Unlock()

	return sum
}

// CollectProcesses is best-effort per-process — a process that exits mid-scan or whose
// details we lack permission to read is simply skipped, not treated as an error.
func CollectProcesses() []ProcessInfo {
	procs, err := gopsprocess.Processes()
	if err != nil {
		return nil
	}

	var out []ProcessInfo
	for _, p := range procs {
		name, err := p.Name()
		if err != nil {
			continue
		}
		ppid, _ := p.Ppid()
		cpuPct, _ := p.CPUPercent()
		memPct, _ := p.MemoryPercent()
		owner, _ := p.Username()
		startTime, _ := p.CreateTime()
		cmdline, _ := p.Cmdline()
		statuses, _ := p.Status()
		status := ""
		if len(statuses) > 0 {
			status = statuses[0]
		}
		exePath, _ := p.Exe()

		out = append(out, ProcessInfo{
			PID:        p.Pid,
			PPID:       ppid,
			Name:       name,
			CPUPercent: cpuPct,
			MemPercent: memPct,
			Owner:      owner,
			StartTime:  startTime,
			Cmdline:    cmdline,
			Status:     status,
			ExePath:    exePath,
			Sha256:     hashExecutable(exePath),
		})
	}
	return out
}
