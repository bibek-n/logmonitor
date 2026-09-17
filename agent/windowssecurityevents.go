package main

// No build tag: like windowseventlog.go, this only shells out to powershell.exe (a runtime
// no-op/error on non-Windows, not a compile-time dependency) - runtime.GOOS guards the actual
// call site (see collectSystemLog's own identical pattern), so this compiles cross-platform.

import (
	"encoding/json"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// CollectWazuhOfficeSecurityEvents is the cross-platform entry point run.go calls - a no-op
// everywhere except Windows for now. Linux auth.log/journalctl-based security event
// monitoring (spec section 11) is a planned follow-up using this same dispatch point and the
// same wazuhOfficeEventPayload shape, not yet implemented.
//
// Self-contained load/collect/save, same pattern as CollectNewLogLines - it calls
// loadLogState() fresh and saves the whole (shared) state struct back itself, rather than
// run.go holding a long-lived copy, so this and CollectNewLogLines (which independently
// does the same thing on its own 60s cycle for EventLogSince/JournalSince) can't clobber
// each other's watermark field even though they run on different intervals - each save only
// ever overwrites the field it actually updated, using whatever was freshest on disk for
// everything else.
func CollectWazuhOfficeSecurityEvents() []wazuhOfficeEventPayload {
	if runtime.GOOS != "windows" {
		return nil
	}
	state := loadLogState()
	events := collectWindowsSecurityEvents(&state)
	saveLogState(state)
	return events
}

const maxSecurityEventEntries = 300

// securityEventRule is one row of the extensible Windows Security Event mapping table (spec
// asked explicitly for this to be extensible, not a hardcoded switch buried in the collector
// logic) - adding coverage for a new Event ID is a new entry here, not a code change.
type securityEventRule struct {
	EventType      string
	Category       string
	Severity       string
	MitreTactic    string
	MitreTechnique string
}

// windowsSecurityEventRules covers the specific Event IDs called out in the spec. Severity
// mirrors real-world risk (a lone 4625 is Low/Medium noise; the detection engine, a separate
// later phase, is what actually correlates repeated 4625s into a brute-force High/Critical
// alert - this table only classifies the single raw event).
var windowsSecurityEventRules = map[int]securityEventRule{
	4624: {"successful_logon", "Authentication", "Informational", "TA0001", "T1078"},
	4625: {"failed_logon", "Authentication", "Medium", "TA0006", "T1110"},
	4634: {"logoff", "Authentication", "Informational", "TA0001", ""},
	4648: {"explicit_credential_use", "Credential Access", "Medium", "TA0006", "T1078"},
	4672: {"special_privileges_assigned", "Privilege Escalation", "Medium", "TA0004", "T1078.003"},
	4688: {"process_creation", "Execution", "Low", "TA0002", "T1059"},
	4720: {"user_created", "Persistence", "High", "TA0003", "T1136"},
	4722: {"user_enabled", "Persistence", "Medium", "TA0003", "T1098"},
	4724: {"password_reset_attempt", "Credential Access", "Medium", "TA0006", "T1098"},
	4725: {"user_disabled", "Impact", "Low", "TA0040", ""},
	4726: {"user_deleted", "Impact", "Medium", "TA0040", "T1531"},
	4728: {"user_added_to_global_group", "Privilege Escalation", "High", "TA0004", "T1098"},
	4732: {"user_added_to_local_group", "Privilege Escalation", "High", "TA0004", "T1098"},
	4740: {"account_locked", "Authentication", "Medium", "TA0006", "T1110"},
	4768: {"kerberos_authentication", "Authentication", "Informational", "TA0001", ""},
	4769: {"kerberos_service_ticket", "Authentication", "Informational", "TA0001", ""},
	4771: {"kerberos_preauth_failed", "Authentication", "Medium", "TA0006", "T1110"},
	4776: {"credential_validation", "Authentication", "Low", "TA0006", ""},
	1102: {"audit_log_cleared", "Defense Evasion", "Critical", "TA0005", "T1070.001"},
}

func securityEventIdList() string {
	ids := make([]string, 0, len(windowsSecurityEventRules))
	for id := range windowsSecurityEventRules {
		ids = append(ids, strconv.Itoa(id))
	}
	return strings.Join(ids, ",")
}

// winSecurityEventEntry mirrors the calculated-property shape emitted by the PowerShell
// script below, same "stringify TimeCreated inside PowerShell" reasoning as
// windowseventlog.go's winEventEntry. EventData is a flattened Name->Value map built from the
// event's own <EventData><Data Name="...">value</Data></EventData> XML, which is where
// Get-WinEvent actually puts the fields Wazuh-style tools care about (TargetUserName,
// IpAddress, NewProcessName, etc.) - Get-WinEvent's own .Message property already renders
// these into a paragraph string, but has no stable per-field structure to parse back out.
type winSecurityEventEntry struct {
	TimeCreated string            `json:"TimeCreated"`
	Id          int               `json:"Id"`
	Message     string            `json:"Message"`
	EventData   map[string]string `json:"EventData"`
}

// firstNonEmpty returns the first non-empty value found in m for the given keys, in order -
// different Event IDs name semantically-equivalent fields differently (e.g. 4624/4625 use
// TargetUserName for the account being logged into, while 4648 uses TargetUserName for the
// account being logged in usingexplicit credentials FROM SubjectUserName) - reasonable
// best-effort rather than a full per-Event-ID field map for every one of the ~19 IDs covered.
func firstNonEmpty(m map[string]string, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != "" && v != "-" {
			return v
		}
	}
	return ""
}

// collectWindowsSecurityEvents ships the specific Security-log Event IDs in
// windowsSecurityEventRules since the last watermark, same incremental approach as
// collectWindowsEventLog (a persisted "since" timestamp). Reading the Security log requires
// the caller to be an administrator or a member of "Event Log Readers" - the agent's own
// Windows service already runs as SYSTEM, which satisfies this without extra setup.
func collectWindowsSecurityEvents(state *logFileState) []wazuhOfficeEventPayload {
	since := state.SecurityEventLogSince
	if since == "" {
		since = time.Now().Add(-24 * time.Hour).UTC().Format(time.RFC3339)
	}
	state.SecurityEventLogSince = time.Now().UTC().Format(time.RFC3339)

	script := `
$since = (Get-Date "` + since + `")
$max = ` + strconv.Itoa(maxSecurityEventEntries) + `
$ids = @(` + securityEventIdList() + `)

$raw = @(Get-WinEvent -FilterHashtable @{LogName='Security';Id=$ids;StartTime=$since} -MaxEvents $max -ErrorAction SilentlyContinue)

$events = @($raw | ForEach-Object {
  $xml = [xml]$_.ToXml()
  $data = @{}
  foreach ($node in $xml.Event.EventData.Data) {
    if ($node.Name) { $data[$node.Name] = [string]$node.'#text' }
  }
  [PSCustomObject]@{
    TimeCreated = $_.TimeCreated.ToUniversalTime().ToString("o")
    Id          = $_.Id
    Message     = $_.Message
    EventData   = $data
  }
})
if ($events.Count -gt 0) { ConvertTo-Json -InputObject $events -Compress -Depth 4 }
`
	out := runPowerShellScript(longPowerShellTimeout, script)
	if strings.TrimSpace(out) == "" {
		return nil
	}

	var raw []winSecurityEventEntry
	// Get-WinEvent/ConvertTo-Json emits a single object (not an array) when exactly one
	// event matches - try the array shape first, then fall back to a lone object, same
	// defensive pattern used elsewhere in this agent for PowerShell JSON output.
	if err := json.Unmarshal([]byte(out), &raw); err != nil {
		var single winSecurityEventEntry
		if err2 := json.Unmarshal([]byte(out), &single); err2 != nil {
			return nil
		}
		raw = []winSecurityEventEntry{single}
	}

	entries := make([]wazuhOfficeEventPayload, 0, len(raw))
	for _, e := range raw {
		rule, known := windowsSecurityEventRules[e.Id]
		if !known {
			continue
		}
		if e.EventData == nil {
			e.EventData = map[string]string{}
		}

		username := firstNonEmpty(e.EventData, "TargetUserName", "SubjectUserName")
		sourceIp := firstNonEmpty(e.EventData, "IpAddress")
		processName := firstNonEmpty(e.EventData, "NewProcessName", "ProcessName")
		commandLine := firstNonEmpty(e.EventData, "CommandLine")

		entries = append(entries, wazuhOfficeEventPayload{
			EventTimestamp: e.TimeCreated,
			Source:         "windows_security_log",
			EventType:      rule.EventType,
			Category:       rule.Category,
			Severity:       rule.Severity,
			Description:    truncate(strings.TrimSpace(e.Message), 2000),
			Username:       username,
			SourceIp:       sourceIp,
			ProcessName:    processName,
			CommandLine:    commandLine,
			MitreTactic:    rule.MitreTactic,
			MitreTechnique: rule.MitreTechnique,
			RawLog:         truncate(strings.TrimSpace(e.Message), 4000),
		})
	}
	return entries
}
