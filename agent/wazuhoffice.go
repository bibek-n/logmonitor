package main

// wazuhOfficeEventPayload mirrors src/app/api/agent/wazuh-office/events/route.ts's expected
// shape. Cross-platform (not just Windows) since Linux auth.log/journalctl monitoring is a
// planned collector using this same payload type - only the Windows Security Event Log
// collector exists so far.
type wazuhOfficeEventPayload struct {
	EventTimestamp string `json:"eventTimestamp,omitempty"`
	Source         string `json:"source"`
	EventType      string `json:"eventType"`
	Category       string `json:"category,omitempty"`
	Severity       string `json:"severity"`
	Description    string `json:"description,omitempty"`
	Username       string `json:"username,omitempty"`
	SourceIp       string `json:"sourceIp,omitempty"`
	ProcessName    string `json:"processName,omitempty"`
	ProcessId      int    `json:"processId,omitempty"`
	CommandLine    string `json:"commandLine,omitempty"`
	MitreTactic    string `json:"mitreTactic,omitempty"`
	MitreTechnique string `json:"mitreTechnique,omitempty"`
	RawLog         string `json:"rawLog,omitempty"`
}

func (c *Client) PostWazuhOfficeEvents(events []wazuhOfficeEventPayload) error {
	if len(events) == 0 {
		return nil
	}
	return c.postJSON("/api/agent/wazuh-office/events", map[string]interface{}{"events": events})
}
