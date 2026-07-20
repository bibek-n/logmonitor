package main

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
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
	// Which nginx/Apache virtual host this line came from (see collectNginxVhostLogs /
	// collectApacheVhostLogs) - empty for a default/non-vhost log and for every other source.
	Site string `json:"siteName,omitempty"`
}

type logFileState struct {
	Offsets       map[string]int64 `json:"offsets"`
	JournalSince  string           `json:"journalSince"`
	EventLogSince string           `json:"eventLogSince"`
}

const maxLogLinesPerFile = 500

// maxLogEntriesPerCycle caps the total entries CollectNewLogLines returns across every
// source/file combined, matching MAX_BATCH in src/app/api/agent/logs/route.ts. A hosting box
// can carry 150+ virtual hosts (confirmed live), each with its own access+error log - without
// this cap, a first-run backlog across all of them could collect far more than the server
// accepts in one POST, and since every read here advances that file's byte offset, anything
// past the server's own truncation point would be silently gone for good rather than
// retried. Passing the shrinking budget into readNewLines as its own per-call line cap (see
// there) is what makes a large backlog spread safely across several 60-second cycles instead.
const maxLogEntriesPerCycle = 4000

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
func collectNginxVhostLogs(state *logFileState, budget *int) []LogEntry {
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
			entries = append(entries, tailFileWithBudget(path, state, budget, source, site)...)
		}
	}
	return entries
}

var (
	apacheServerNameRe = regexp.MustCompile(`(?im)^[ \t]*ServerName[ \t]+(\S+)`)
	apacheCustomLogRe  = regexp.MustCompile(`(?im)^[ \t]*CustomLog[ \t]+"?([^"\s]+)"?`)
	apacheErrorLogRe   = regexp.MustCompile(`(?im)^[ \t]*ErrorLog[ \t]+"?([^"\s]+)"?`)
)

type apacheVhostLogRef struct {
	site   string
	access string
	errorP string
}

// apacheVhostConfDir returns the directory holding one enabled config file per virtual host,
// Debian/Ubuntu's and RHEL/CentOS's conventions respectively - first one found wins.
func apacheVhostConfDir() string {
	for _, d := range []string{"/etc/apache2/sites-enabled", "/etc/httpd/conf.d"} {
		if info, err := os.Stat(d); err == nil && info.IsDir() {
			return d
		}
	}
	return ""
}

func resolveApacheLogPath(raw, logDir string) string {
	raw = strings.TrimPrefix(raw, "${APACHE_LOG_DIR}/")
	if strings.HasPrefix(raw, "/") {
		return raw
	}
	return filepath.Join(logDir, raw)
}

// discoverApacheVhostLogs parses every enabled vhost config file for its ServerName plus
// CustomLog/ErrorLog directives, rather than guessing a log filename convention from a glob
// pattern the way collectNginxVhostLogs does for nginx. This app's real hosting boxes
// accumulated wildly inconsistent per-vhost log naming over the years - confirmed live
// across ~150 vhosts on one server: some "<name>_access.log", some "<name>.access.log", some
// a bare "<name>.log" with no "access"/"error" anywhere in the name (e.g. "bolpatra.log"
// paired with "bolpatraerror.log", no separator at all). A filename-suffix approach would
// misclassify or silently miss a large fraction of these; reading Apache's own config is the
// only reliable source of truth for what each vhost actually logs to. Assumes one
// ServerName/CustomLog/ErrorLog trio per enabled config file (true of every vhost checked on
// this fleet, including the certbot-generated -le-ssl.conf variants) rather than parsing
// <VirtualHost> block boundaries - a config file with multiple vhost blocks would misattribute
// directives across them, but that layout doesn't occur anywhere in this fleet today.
func discoverApacheVhostLogs() []apacheVhostLogRef {
	confDir := apacheVhostConfDir()
	if confDir == "" {
		return nil
	}
	matches, err := filepath.Glob(filepath.Join(confDir, "*.conf"))
	if err != nil {
		return nil
	}

	logDir := "/var/log/apache2"
	if _, err := os.Stat(logDir); err != nil {
		logDir = "/var/log/httpd"
	}

	var refs []apacheVhostLogRef
	for _, confPath := range matches {
		data, err := os.ReadFile(confPath)
		if err != nil {
			continue
		}
		content := string(data)
		nameMatch := apacheServerNameRe.FindStringSubmatch(content)
		if nameMatch == nil {
			continue
		}
		ref := apacheVhostLogRef{site: nameMatch[1]}
		if m := apacheCustomLogRe.FindStringSubmatch(content); m != nil {
			ref.access = resolveApacheLogPath(m[1], logDir)
		}
		if m := apacheErrorLogRe.FindStringSubmatch(content); m != nil {
			ref.errorP = resolveApacheLogPath(m[1], logDir)
		}
		if ref.access != "" || ref.errorP != "" {
			refs = append(refs, ref)
		}
	}
	return refs
}

// collectApacheVhostLogs mirrors collectNginxVhostLogs's role for Apache installs, but
// sources its file list from discoverApacheVhostLogs (config-derived) instead of a glob.
// A -le-ssl.conf certbot vhost and its plain-HTTP counterpart for the same site commonly
// point at the very same log file - re-tailing an already-drained path here is harmless
// (readNewLines just finds nothing new the second time), so no de-duplication is needed.
func collectApacheVhostLogs(state *logFileState, budget *int) []LogEntry {
	if runtime.GOOS == "windows" {
		return nil
	}
	var entries []LogEntry
	for _, ref := range discoverApacheVhostLogs() {
		if ref.access != "" {
			entries = append(entries, tailFileWithBudget(ref.access, state, budget, "apache_access", ref.site)...)
		}
		if ref.errorP != "" {
			entries = append(entries, tailFileWithBudget(ref.errorP, state, budget, "apache_error", ref.site)...)
		}
	}
	return entries
}

// tailFileWithBudget reads new lines from path (byte-offset tracked in state.Offsets, same
// as every log source) capped at whatever remains of *budget this cycle, and decrements it
// by however many lines were actually kept. Skips entirely once budget is already exhausted.
func tailFileWithBudget(path string, state *logFileState, budget *int, source, site string) []LogEntry {
	if *budget <= 0 {
		return nil
	}
	maxLines := maxLogLinesPerFile
	if *budget < maxLines {
		maxLines = *budget
	}
	lines, newOffset, ok := readNewLines(path, state.Offsets[path], maxLines)
	if !ok {
		return nil
	}
	state.Offsets[path] = newOffset
	var entries []LogEntry
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		entries = append(entries, LogEntry{Source: source, Site: site, Raw: line, Message: truncate(line, 2000)})
		*budget--
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
	budget := maxLogEntriesPerCycle

	for source, paths := range candidateLogPaths() {
		if budget <= 0 {
			break
		}
		for _, path := range paths {
			got := tailFileWithBudget(path, &state, &budget, source, "")
			if got == nil {
				if _, err := os.Stat(path); err != nil {
					continue // this candidate path doesn't exist on this host - try the next one
				}
			}
			entries = append(entries, got...)
			break // first existing candidate path for this source wins
		}
	}

	entries = append(entries, collectNginxVhostLogs(&state, &budget)...)
	entries = append(entries, collectApacheVhostLogs(&state, &budget)...)
	entries = append(entries, collectMssqlLogs(&state, &budget)...)
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

// readNewLines reads from byte offset `from`, capped at maxLines lines, and returns the
// exact byte offset immediately after the last line actually kept - never the file's true
// current end-of-file. That distinction matters once a file's pending backlog exceeds
// maxLines: advancing to true EOF regardless (as this used to do, tracking size via a single
// f.Stat() call before scanning) would silently and permanently drop every line past the
// cap, cycle after cycle, rather than picking the remainder up on a later call as intended.
// ok=false means the file doesn't exist/can't be opened — expected for any log source not
// installed on this host.
func readNewLines(path string, from int64, maxLines int) (lines []string, newOffset int64, ok bool) {
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
	pos := from
	for scanner.Scan() {
		if len(lines) >= maxLines {
			break
		}
		lines = append(lines, scanner.Text())
		pos += int64(len(scanner.Bytes())) + 1 // +1 for the newline the scanner split on and stripped
	}
	return lines, pos, true
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
		// runShell (not runOut) - same "sh -c 'a | b'" pipe-hangs-past-its-timeout risk
		// linuxsecurity.go's runShell doc comment describes, so it gets the same
		// process-group-kill fix rather than runOut's plain single-process kill.
		out := runShell(subprocessTimeout, "journalctl --since '"+since+"' --no-pager -o short-iso 2>/dev/null | tail -n "+strconv.Itoa(maxLogLinesPerFile))
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

	budget := maxLogLinesPerFile
	lines, newOffset, ok := readNewLines("/var/log/syslog", state.Offsets["/var/log/syslog"], budget)
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
