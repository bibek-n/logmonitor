package main

import (
	"io"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"unicode/utf16"
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

// readMssqlErrorLogLines reads new lines from SQL Server's ERRORLOG, which - unlike every
// other log source this agent tails - is UTF-16LE with a BOM by default. A naive byte-level
// split on 0x0A (readNewLines' approach, correct for UTF-8/ASCII sources) finds the low byte
// of the UTF-16LE '\n' character fine, but leaves its high (zero) byte stray at the start of
// the next line, shifting every subsequent character by one byte - confirmed live, it
// renders as null-interleaved garbage once shipped. Decoding as UTF-16 code units instead of
// raw bytes keeps line boundaries and the resumable byte offset exact.
func readMssqlErrorLogLines(path string, from int64, maxLines int) (lines []string, newOffset int64, ok bool) {
	f, err := os.Open(path)
	if err != nil {
		return nil, from, false
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return nil, from, false
	}
	if info.Size() < from {
		from = 0 // rotated/truncated since last read - start over
	}

	bom := make([]byte, 2)
	n, _ := f.ReadAt(bom, 0)
	isUtf16LE := n == 2 && bom[0] == 0xFF && bom[1] == 0xFE
	if from == 0 && isUtf16LE {
		from = 2 // skip the BOM itself, it's not part of any line
	}

	if from > 0 {
		if _, err := f.Seek(from, 0); err != nil {
			return nil, from, false
		}
	}
	raw, err := io.ReadAll(f)
	if err != nil {
		return nil, from, false
	}

	if !isUtf16LE {
		// Fallback for older SQL Server versions/configurations that write ERRORLOG as
		// plain ANSI/UTF-8 - ordinary byte-level line splitting works fine there.
		all := strings.Split(string(raw), "\n")
		complete := all[:len(all)-1]
		if len(complete) > maxLines {
			complete = complete[:maxLines]
		}
		consumed := 0
		for i, l := range complete {
			consumed += len(l) + 1
			complete[i] = strings.TrimSuffix(l, "\r")
		}
		return complete, from + int64(consumed), true
	}

	if len(raw)%2 == 1 {
		raw = raw[:len(raw)-1] // odd trailing byte = an incomplete code unit still being written
	}
	units := make([]uint16, len(raw)/2)
	for i := range units {
		units[i] = uint16(raw[2*i]) | uint16(raw[2*i+1])<<8
	}

	var complete []string
	lineStart := 0
	consumedUnits := 0
	for i, u := range units {
		if u != '\n' {
			continue
		}
		complete = append(complete, strings.TrimSuffix(string(utf16.Decode(units[lineStart:i])), "\r"))
		lineStart = i + 1
		consumedUnits = lineStart
		if len(complete) >= maxLines {
			break
		}
	}

	return complete, from + int64(consumedUnits)*2, true
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
		lines, newOffset, ok := readMssqlErrorLogLines(path, state.Offsets[path], maxLines)
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
