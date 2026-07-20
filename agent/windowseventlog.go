package main

import (
	"encoding/json"
	"strconv"
	"strings"
	"time"
)

const maxEventLogEntries = 200

// winEventEntry mirrors the calculated-property shape emitted by the PowerShell script
// below - TimeCreated is pre-stringified to ISO-8601 ("o" format) inside PowerShell rather
// than left as a native DateTime, because ConvertTo-Json's default DateTime serialization
// (the legacy "\/Date(ms)\/" convention on Windows PowerShell 5.1) is awkward to parse
// reliably in Go and differs from PowerShell 7's behavior - stringifying up front sidesteps
// that entirely and works identically on every supported PowerShell version.
type winEventEntry struct {
	TimeCreated      string `json:"TimeCreated"`
	LevelDisplayName string `json:"LevelDisplayName"`
	Id               int    `json:"Id"`
	ProviderName     string `json:"ProviderName"`
	LogName          string `json:"LogName"`
	Message          string `json:"Message"`
}

// collectWindowsEventLog ships Critical/Error/Warning entries from the System and
// Application logs, plus IIS- and .NET-specific events, since the last watermark - same
// deduping approach as collectSystemLog's journalctl path on Linux (a persisted "since"
// timestamp, not a byte offset, since Get-WinEvent has no such concept).
//
// This originally only queried Level 1/2 (Critical/Error) from System/Application, which
// missed almost everything IIS- or .NET-specific: app pool recycles/crashes are logged by
// "WAS"/"W3SVC" at Warning, and most ".NET Runtime"/"ASP.NET" entries are Informational, not
// Error. Widened to Level 1-3 for System/Application, plus an unrestricted-severity query for
// a fixed list of IIS/.NET provider names (since useful operational signal there is
// routinely Informational, not just errors), plus a best-effort pass over the dedicated IIS
// Operational event channels when they exist and are enabled (neither is guaranteed - IIS
// doesn't turn these on by default, confirmed live on a real production box where
// Microsoft-IIS-Configuration/Operational existed but IsEnabled=False).
func collectWindowsEventLog(state *logFileState) []LogEntry {
	since := state.EventLogSince
	if since == "" {
		// 24h, not a few minutes: a freshly enrolled or just-restarted agent (e.g. after an
		// update) would otherwise start its watermark at "now" and show nothing at all until
		// a new event happens to occur after that instant - confirmed live, this is exactly
		// why a freshly re-enrolled device showed an empty Event Viewer card despite the box
		// having real recent history.
		since = time.Now().Add(-24 * time.Hour).UTC().Format(time.RFC3339)
	}
	state.EventLogSince = time.Now().UTC().Format(time.RFC3339)

	script := `
$since = (Get-Date "` + since + `")
$max = ` + strconv.Itoa(maxEventLogEntries) + `
$providers = 'WAS','W3SVC','IISADMIN','.NET Runtime','ASP.NET','ASP.NET 4.0.30319.0','Microsoft-Windows-IIS-W3SVC','Microsoft-Windows-IIS-W3SVC-WP'
$iisChannels = 'Microsoft-IIS-Configuration/Operational','Microsoft-IIS-Logging/Operational','Microsoft-IIS-W3SVC-WP/Operational'

$all = New-Object System.Collections.ArrayList
[void]$all.AddRange(@(Get-WinEvent -FilterHashtable @{LogName='System','Application';Level=1,2,3;StartTime=$since} -MaxEvents $max -ErrorAction SilentlyContinue))
[void]$all.AddRange(@(Get-WinEvent -FilterHashtable @{LogName='Application';ProviderName=$providers;StartTime=$since} -MaxEvents $max -ErrorAction SilentlyContinue))
foreach ($chan in $iisChannels) {
  try {
    [void]$all.AddRange(@(Get-WinEvent -FilterHashtable @{LogName=$chan;Level=1,2,3;StartTime=$since} -MaxEvents $max -ErrorAction Stop))
  } catch {
    # channel doesn't exist, or exists but logging isn't enabled for it - both are normal,
    # not every IIS install turns these on.
  }
}

# The three queries above can overlap (an IIS/.NET provider event at Level<=3 matches both
# the System/Application query and the provider-name query) - dedupe by (LogName, RecordId),
# the only combination that's actually unique across different channels.
$seen = New-Object System.Collections.Generic.HashSet[string]
$deduped = New-Object System.Collections.ArrayList
foreach ($e in ($all | Sort-Object TimeCreated -Descending)) {
  $key = "$($e.LogName)|$($e.RecordId)"
  if ($seen.Add($key)) {
    [void]$deduped.Add($e)
    if ($deduped.Count -ge $max) { break }
  }
}

$events = @($deduped | Select-Object @{N='TimeCreated';E={$_.TimeCreated.ToUniversalTime().ToString("o")}}, LevelDisplayName, Id, ProviderName, LogName, Message)
if ($events.Count -gt 0) { ConvertTo-Json -InputObject $events -Compress -Depth 3 }
`
	out := runPowerShellScript(longPowerShellTimeout, script)
	if strings.TrimSpace(out) == "" {
		return nil
	}

	var events []winEventEntry
	if err := json.Unmarshal([]byte(out), &events); err != nil {
		return nil
	}

	entries := make([]LogEntry, 0, len(events))
	for _, e := range events {
		severity := "error"
		switch {
		case strings.EqualFold(e.LevelDisplayName, "Critical"):
			severity = "critical"
		case strings.EqualFold(e.LevelDisplayName, "Warning"):
			severity = "warning"
		case strings.EqualFold(e.LevelDisplayName, "Information"), strings.EqualFold(e.LevelDisplayName, "Verbose"):
			severity = "info"
		}
		msg := strings.TrimSpace(e.Message)
		if msg == "" {
			msg = e.LevelDisplayName + " event"
		}
		logName := e.LogName
		if logName == "" {
			logName = "Unknown"
		}
		// The Windows "System" channel is the direct analog of collectSystemLog's
		// Linux journalctl/syslog output (Source: "system") - routed the same way so the
		// dashboard's "System" tab shows it, instead of lumping it in with Application/IIS
		// events under "Event Viewer".
		source := "eventlog"
		if logName == "System" {
			source = "system"
		}
		entries = append(entries, LogEntry{
			Source:    source,
			Timestamp: e.TimeCreated,
			Severity:  severity,
			Message:   truncate("["+logName+"] "+e.ProviderName+" (ID "+strconv.Itoa(e.Id)+"): "+msg, 2000),
			Raw:       msg,
		})
	}
	return entries
}
