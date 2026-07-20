package main

import (
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
)

// mssqlSlowPattern matches SQL Server's own "I/O requests taking longer than N seconds to
// complete" warning - the canonical, always-on signal SQL Server emits into its error log
// when a disk read/write exceeds its internal threshold, tagged as a distinct source
// ("mssql_slow") so the dashboard can surface it separately from routine error-log noise.
var mssqlSlowPattern = regexp.MustCompile(`(?i)taking longer than \d+ seconds to complete`)

// mssqlErrorPattern matches SQL Server's "Error: <n>, Severity: <n>" marker line - the
// severity number is SQL Server's own classification (>=17 is a resource/hardware-class
// error such as the disk-full backup failures seen live on this fleet, 11-16 is a
// user/statement-class error).
var mssqlErrorPattern = regexp.MustCompile(`Error: \d+, Severity: (\d+)`)

// mssqlErrorLogPaths finds every instance's *live* ERRORLOG file (the undotted one -
// ERRORLOG.1, .2, etc. are past rotations, never tailed). Glob rather than a registry
// lookup: every default SQL Server install on Windows uses this exact directory layout
// ("Microsoft SQL Server\MSSQL<major>.<InstanceName>\MSSQL\Log\ERRORLOG"), confirmed live
// against a real instance, and a glob needs no registry access the LocalSystem agent might
// not have on a locked-down box.
func mssqlErrorLogPaths() []string {
	if runtime.GOOS != "windows" {
		return nil
	}
	matches, _ := filepath.Glob(`C:\Program Files\Microsoft SQL Server\MSSQL*.*\MSSQL\Log\ERRORLOG`)
	return matches
}

// MssqlLogDetected gates whether the Servers overview page shows an MSSQL tab/section -
// mirrors IisDetected/LinuxSecurityDetected's role for their own features.
func MssqlLogDetected() bool {
	return len(mssqlErrorLogPaths()) > 0
}

// collectMssqlLogs tails every detected instance's live ERRORLOG the same offset-tracked way
// tailFileWithBudget does for Apache/nginx, but classifies each line into "mssql" or
// "mssql_slow" and derives severity from SQL Server's own error marker instead of shipping
// everything at a single default.
func collectMssqlLogs(state *logFileState, budget *int) []LogEntry {
	var entries []LogEntry
	for _, path := range mssqlErrorLogPaths() {
		if *budget <= 0 {
			break
		}
		maxLines := maxLogLinesPerFile
		if *budget < maxLines {
			maxLines = *budget
		}
		lines, newOffset, ok := readNewLines(path, state.Offsets[path], maxLines)
		if !ok {
			continue
		}
		state.Offsets[path] = newOffset
		for _, line := range lines {
			if strings.TrimSpace(line) == "" {
				continue
			}
			source := "mssql"
			severity := "info"
			if m := mssqlErrorPattern.FindStringSubmatch(line); m != nil {
				severity = "error"
				if sev, err := strconv.Atoi(m[1]); err == nil && sev >= 17 {
					severity = "critical"
				}
			} else if mssqlSlowPattern.MatchString(line) {
				source = "mssql_slow"
				severity = "warning"
			}
			entries = append(entries, LogEntry{Source: source, Severity: severity, Raw: line, Message: truncate(line, 2000)})
			*budget--
		}
	}
	return entries
}
