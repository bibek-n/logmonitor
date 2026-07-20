package main

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// LogEntry mirrors src/app/api/agent/logs/route.ts's expected shape.
type LogEntry struct {
	Source    string `json:"source"`
	Timestamp string `json:"timestamp,omitempty"`
	Message   string `json:"message"`
	Raw       string `json:"raw"`
	Severity  string `json:"severity,omitempty"`
	// Which nginx virtual host this line came from (see collectNginxVhostLogs) - empty for
	// the default nginx log and for every non-nginx source.
	Site string `json:"siteName,omitempty"`
}

type logFileState struct {
	Offsets       map[string]int64 `json:"offsets"`
	JournalSince  string           `json:"journalSince"`
	EventLogSince string           `json:"eventLogSince"`
}

const maxLogLinesPerFile = 500

func logStatePath() string {
	return filepath.Join(filepath.Dir(ConfigPath()), "logstate.json")
}

func loadLogState() logFileState {
	state := logFileState{Offsets: map[string]int64{}}
	data, err := os.ReadFile(logStatePath())
	if err == nil {
		_ = json.Unmarshal(data, &state)
	}
	if state.Offsets == nil {
		state.Offsets = map[string]int64{}
	}
	return state
}

func saveLogState(state logFileState) {
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(logStatePath(), data, 0600)
}

// candidateLogPaths returns, per log source, the paths to check in priority order — the
// first one that exists on this host wins. Missing paths are silently skipped: a server
// without Apache/MySQL installed just reports fewer sources, never an error.
func candidateLogPaths() map[string][]string {
	if runtime.GOOS == "windows" {
		return map[string][]string{
			"apache_access": {`C:\xampp\apache\logs\access.log`, `C:\Apache24\logs\access.log`},
			"apache_error":  {`C:\xampp\apache\logs\error.log`, `C:\Apache24\logs\error.log`},
			"nginx_access":  {`C:\nginx\logs\access.log`},
			"nginx_error":   {`C:\nginx\logs\error.log`},
			"mysql":         {`C:\xampp\mysql\data\mysql_error.log`},
			"php":           {`C:\xampp\php\logs\php_error_log`},
		}
	}
	return map[string][]string{
		"apache_access": {"/var/log/apache2/access.log", "/var/log/httpd/access_log"},
		"apache_error":  {"/var/log/apache2/error.log", "/var/log/httpd/error_log"},
		"nginx_access":  {"/var/log/nginx/access.log"},
		"nginx_error":   {"/var/log/nginx/error.log"},
		"mysql":         {"/var/log/mysql/error.log", "/var/log/mysqld.log"},
		"php":           {"/var/log/php_errors.log", "/var/log/php-fpm/error.log", "/var/log/php8.1-fpm.log"},
	}
}

// nginxVhostLogGlobs returns, per log source, the glob pattern nginx installs commonly use
// for a per-virtual-host log file - confirmed live against a real multi-site install
// (/var/log/nginx/<vhost>.access.log, one pair per site-enabled config, set via that vhost's
// own access_log/error_log directives). The plain access.log/error.log matched by
// candidateLogPaths() above is deliberately excluded here (via nginxDefaultLogNames) so the
// default log is never shipped twice under two different source/site combinations.
func nginxVhostLogGlobs() map[string]string {
	if runtime.GOOS == "windows" {
		return nil // no evidence of a per-vhost convention on Windows nginx installs - skip rather than guess
	}
	return map[string]string{
		"nginx_access": "/var/log/nginx/*.access.log",
		"nginx_error":  "/var/log/nginx/*.error.log",
	}
}

var nginxDefaultLogNames = map[string]bool{"access.log": true, "error.log": true}

// collectNginxVhostLogs discovers every per-vhost nginx log file matching nginxVhostLogGlobs
// and tails each one independently (same byte-offset tracking as candidateLogPaths sources,
// keyed by the file's absolute path in state.Offsets - already generic, no changes needed
// there). The vhost name is derived from the filename with its .access.log/.error.log suffix
// stripped, e.g. "adminbondeniskolan.access.log" -> site "adminbondeniskolan". A vhost that
// stops existing (site removed) just stops appearing in future glob results - its stale
// offset entry is harmless dead weight in logstate.json, not worth actively pruning.
func collectNginxVhostLogs(state *logFileState) []LogEntry {
	var entries []LogEntry
	for source, pattern := range nginxVhostLogGlobs() {
		suffix := ".access.log"
		if source == "nginx_error" {
			suffix = ".error.log"
		}
		matches, err := filepath.Glob(pattern)
		if err != nil {
			continue
		}
		for _, path := range matches {
			base := filepath.Base(path)
			if nginxDefaultLogNames[base] {
				continue
			}
			site := strings.TrimSuffix(base, suffix)

			lines, newOffset, ok := readNewLines(path, state.Offsets[path])
			if !ok {
				continue
			}
			state.Offsets[path] = newOffset
			for _, line := range lines {
				if strings.TrimSpace(line) == "" {
					continue
				}
				entries = append(entries, LogEntry{Source: source, Site: site, Raw: line, Message: truncate(line, 2000)})
			}
		}
	}
	return entries
}

// CollectNewLogLines reads any lines appended to known log files since the last call
// (tail -f semantics via a persisted byte offset, so a restart never re-ships the whole
// file) plus recent system log entries. Best-effort throughout: an unreadable/missing path
// is skipped, never an error.
func CollectNewLogLines() []LogEntry {
	state := loadLogState()
	var entries []LogEntry

	for source, paths := range candidateLogPaths() {
		for _, path := range paths {
			lines, newOffset, ok := readNewLines(path, state.Offsets[path])
			if !ok {
				continue
			}
			state.Offsets[path] = newOffset
			for _, line := range lines {
				if strings.TrimSpace(line) == "" {
					continue
				}
				entries = append(entries, LogEntry{Source: source, Raw: line, Message: truncate(line, 2000)})
			}
			break // first existing candidate path for this source wins
		}
	}

	entries = append(entries, collectNginxVhostLogs(&state)...)
	entries = append(entries, collectSystemLog(&state)...)

	saveLogState(state)
	return entries
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}

// readNewLines reads from byte offset `from` to EOF, capped at maxLogLinesPerFile lines
// per call (a large first-run backlog is picked up gradually over subsequent cycles
// rather than flooding a single upload). ok=false means the file doesn't exist/can't be
// opened — expected for any log source not installed on this host.
func readNewLines(path string, from int64) (lines []string, newOffset int64, ok bool) {
	f, err := os.Open(path)
	if err != nil {
		return nil, from, false
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return nil, from, false
	}
	// Rotation detection: if the file is now smaller than our last offset, it was rotated
	// (or truncated) — start from the top rather than seeking past EOF.
	if info.Size() < from {
		from = 0
	}
	if from > 0 {
		if _, err := f.Seek(from, 0); err != nil {
			return nil, from, false
		}
	}

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		if len(lines) < maxLogLinesPerFile {
			lines = append(lines, scanner.Text())
		}
	}
	return lines, info.Size(), true
}

// collectSystemLog ships recent system-level events: systemd journal on Linux hosts that
// have it (deduped via a timestamp watermark, since journalctl has no byte-offset
// concept), falling back to tailing /var/log/syslog like any other file otherwise; Windows
// Event Log (Critical/Error entries) via collectWindowsEventLog, same watermark approach.
func collectSystemLog(state *logFileState) []LogEntry {
	if runtime.GOOS == "windows" {
		return collectWindowsEventLog(state)
	}

	if _, err := os.Stat("/run/systemd/system"); err == nil {
		since := state.JournalSince
		if since == "" {
			since = time.Now().Add(-5 * time.Minute).UTC().Format("2006-01-02 15:04:05")
		}
		out := runOut("sh", "-c", "journalctl --since '"+since+"' --no-pager -o short-iso 2>/dev/null | tail -n "+strconv.Itoa(maxLogLinesPerFile))
		state.JournalSince = time.Now().UTC().Format("2006-01-02 15:04:05")
		if out == "" {
			return nil
		}
		var entries []LogEntry
		for _, l := range strings.Split(out, "\n") {
			if strings.TrimSpace(l) == "" {
				continue
			}
			entries = append(entries, LogEntry{Source: "system", Raw: l, Message: truncate(l, 2000)})
		}
		return entries
	}

	lines, newOffset, ok := readNewLines("/var/log/syslog", state.Offsets["/var/log/syslog"])
	if !ok {
		return nil
	}
	state.Offsets["/var/log/syslog"] = newOffset
	var entries []LogEntry
	for _, l := range lines {
		if strings.TrimSpace(l) == "" {
			continue
		}
		entries = append(entries, LogEntry{Source: "system", Raw: l, Message: truncate(l, 2000)})
	}
	return entries
}
