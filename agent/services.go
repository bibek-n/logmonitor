package main

// ServiceInfo is a read-only snapshot entry — no start/stop/restart in this phase
// (deferred pending a dedicated remote-actions security design).
type ServiceInfo struct {
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	Status      string `json:"status"` // running | stopped | failed | unknown
	StartupType string `json:"startupType"`
	ExecPath    string `json:"execPath"`
	Account     string `json:"account"`
}
