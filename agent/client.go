package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"runtime"
	"time"
)

// AgentVersion defaults to "dev" for local builds; CI overrides it via
// `-ldflags "-X main.AgentVersion=<tag>"` so a running agent's version compare
// (see update.go) reflects the actual release tag it was built from.
var AgentVersion = "dev"

type Client struct {
	ServerURL string
	DeviceID  string
	APIKey    string
	http      *http.Client
}

func NewClient(serverURL, deviceID, apiKey string) *Client {
	return &Client{
		ServerURL: serverURL,
		DeviceID:  deviceID,
		APIKey:    apiKey,
		http:      &http.Client{Timeout: 20 * time.Second},
	}
}

type EnrollResponse struct {
	OK        bool   `json:"ok"`
	Error     string `json:"error"`
	DeviceID  string `json:"deviceId"`
	APIKey    string `json:"apiKey"`
	ChatToken string `json:"chatToken"`
}

// Enroll exchanges a one-time enrollment token for a persistent device API key. Requires
// consentAccepted=true — the server rejects enrollment otherwise, and the caller (main.go)
// only reaches here after the local consent notice has been shown and accepted.
func Enroll(serverURL, token, hostname, osVersion string) (*EnrollResponse, error) {
	body, _ := json.Marshal(map[string]interface{}{
		"enrollmentToken": token,
		"hostname":        hostname,
		"os":              runtime.GOOS,
		"osVersion":       osVersion,
		"agentVersion":    AgentVersion,
		"consentAccepted": true,
		"macAddress":      PrimaryMacAddress(),
	})

	resp, err := http.Post(serverURL+"/api/agent/enroll", "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var out EnrollResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	if !out.OK {
		return nil, fmt.Errorf("enrollment failed: %s", out.Error)
	}
	return &out, nil
}

type HeartbeatResponse struct {
	OK                             bool                   `json:"ok"`
	ScreenshotIntervalMinutes      *int                   `json:"screenshotIntervalMinutes"`
	BrowserActivityIntervalMinutes *int                   `json:"browserActivityIntervalMinutes"`
	ExcludedDomainSuffixes         []string               `json:"excludedDomainSuffixes"`
	PrivacyMode                    bool                   `json:"privacyMode"`
	PendingScreenshotRequest       bool                   `json:"pendingScreenshotRequest"`
	PendingMalwareScanRequest      bool                   `json:"pendingMalwareScanRequest"`
	PendingPhpLogRequests          []PhpLogRequest        `json:"pendingPhpLogRequests"`
	PendingAutomationJobs          []PendingAutomationJob `json:"pendingAutomationJobs"`
	UsbBlockList                   []UsbPolicyEntry       `json:"usbBlockList"`
	WatchedFiles                   []string               `json:"watchedFiles"`
	// WacBlockedDomains is Website Access Control's enforcement list for THIS device - always
	// sent (even empty), never omitted, same "always send, diff locally" convention as
	// UsbBlockList above. Populated server-side only when Devices.WebsiteBlockingEnabled is set
	// for this device (opt-in per device, same guarantee as ScreenshotIntervalMinutes/
	// BrowserActivityIntervalMinutes - see /api/agent/heartbeat/route.ts). Applied via
	// ApplyWacBlocklist (wacblock_windows.go); no-op on non-Windows builds (wacblock_other.go).
	WacBlockedDomains []string `json:"wacBlockedDomains"`
	// AgentTargetVersion is the release tag an admin has explicitly approved for THIS
	// device's DeviceType (Workstation vs Server) via the Agent Rollout dashboard - nil
	// means "no rollout approved, hold at current version". Unlike every other field
	// above, this deliberately does NOT mean "the latest GitHub release" - see
	// update.go's CheckForUpdate, which only ever installs this exact approved tag, never
	// whatever happens to be newest upstream. This is what lets employee PCs and servers
	// be staged independently instead of both silently grabbing the same release.
	AgentTargetVersion *string `json:"agentTargetVersion"`
	// PendingPowerAction is "reboot", "shutdown", or nil - see run.go, which ACKs (via
	// AckPowerAction below) BEFORE executing it, never after.
	PendingPowerAction *string `json:"pendingPowerAction"`
}

func (c *Client) authRequest(method, path string, body io.Reader, contentType string) (*http.Request, error) {
	req, err := http.NewRequest(method, c.ServerURL+path, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Device-Id", c.DeviceID)
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	return req, nil
}

func (c *Client) Heartbeat() (*HeartbeatResponse, error) {
	// Website Access Control: reports back what the most recent ApplyWacBlocklist run actually
	// applied (and any error hit along the way) via the same heartbeat round-trip, rather than a
	// separate endpoint - see /api/agent/heartbeat/route.ts, which persists these into
	// Devices.WacLastAppliedAt/WacLastError only when present. wacAppliedDomains is always sent
	// (even nil/empty) so a device that goes from blocking something to blocking nothing
	// correctly clears its last-applied state server-side too. WacStatus() is a no-op returning
	// (nil, "") on non-Windows builds - see wacblock_other.go.
	wacApplied, wacErr := WacStatus()
	payload := map[string]interface{}{
		"agentVersion":      AgentVersion,
		"currentUser":       CurrentLoggedInUser(),
		"wacAppliedDomains": wacApplied,
	}
	if wacErr != "" {
		payload["wacError"] = wacErr
	} else {
		payload["wacError"] = nil
	}
	body, _ := json.Marshal(payload)
	req, err := c.authRequest("POST", "/api/agent/heartbeat", bytes.NewReader(body), "application/json")
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var out HeartbeatResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("heartbeat failed: HTTP %d", resp.StatusCode)
	}
	return &out, nil
}

type MetricsPayload struct {
	CpuPct                float64      `json:"cpuPct"`
	MemPct                float64      `json:"memPct"`
	DiskPct               float64      `json:"diskPct"`
	NetRxMbps             float64      `json:"netRxMbps"`
	NetTxMbps             float64      `json:"netTxMbps"`
	UptimeSeconds         int64        `json:"uptimeSeconds"`
	SwapPct               float64      `json:"swapPct"`
	DiskReadMBps          float64      `json:"diskReadMBps"`
	DiskWriteMBps         float64      `json:"diskWriteMBps"`
	DiskIops              float64      `json:"diskIops"`
	ProcessCount          int          `json:"processCount"`
	ThreadCount           int          `json:"threadCount"`
	HandleCount           int          `json:"handleCount"`
	LoadAvg1              float64      `json:"loadAvg1"`
	LoadAvg5              float64      `json:"loadAvg5"`
	LoadAvg15             float64      `json:"loadAvg15"`
	GpuUsagePct           float64      `json:"gpuUsagePct"`
	BatteryPct            float64      `json:"batteryPct"`
	BatteryHealth         string       `json:"batteryHealth"`
	BatteryCycleCount     int          `json:"batteryCycleCount"`
	PowerAdapterConnected *bool        `json:"powerAdapterConnected"`
	CpuTempC              float64      `json:"cpuTempC"`
	DiskFreeGB            float64      `json:"diskFreeGB"`
	DiskTotalGB           float64      `json:"diskTotalGB"`
	DiskLatencyMs         float64      `json:"diskLatencyMs"`
	Volumes               []VolumeInfo `json:"volumes"`
}

// VolumeInfo is one currently-mounted volume - every Windows drive letter, every Linux
// mount point - as opposed to MetricsPayload's DiskPct/DiskFreeGB/DiskTotalGB, which only
// ever tracks whichever single partition happens to be fullest right now with no record of
// which one that was. Pseudo-filesystems (tmpfs, overlay, proc, etc.) are filtered out
// before this ever reaches here - see the filter list in metrics.go's CollectMetrics.
type VolumeInfo struct {
	MountPoint  string  `json:"mountPoint"`
	Device      string  `json:"device"`
	FsType      string  `json:"fsType"`
	TotalGB     float64 `json:"totalGB"`
	FreeGB      float64 `json:"freeGB"`
	UsedPercent float64 `json:"usedPercent"`
}

// WindowsUpdateStatus is Windows-only - CollectWindowsUpdateStatus returns the zero value
// on other platforms, and the server treats absent/zero fields as "unknown", not "no
// updates ever installed", so posting the zero value from a Linux host is harmless.
type WindowsUpdateStatus struct {
	LastInstalledAt   string `json:"lastInstalledAt,omitempty"`
	RecentHotfixCount int    `json:"recentHotfixCount"`
	RebootPending     bool   `json:"rebootPending"`
}

// postJSON is the shared helper for every new best-effort snapshot upload — each just
// marshals its payload and posts it under device auth, same as PostMetrics already did.
func (c *Client) postJSON(path string, payload interface{}) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := c.authRequest("POST", path, bytes.NewReader(body), "application/json")
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("POST %s failed: HTTP %d", path, resp.StatusCode)
	}
	return nil
}

func (c *Client) PostMetrics(m MetricsPayload) error { return c.postJSON("/api/agent/metrics", m) }

func (c *Client) PostWindowsUpdateStatus(w WindowsUpdateStatus) error {
	return c.postJSON("/api/agent/windows-update-status", w)
}

func (c *Client) PostIisStatus(s IisStatus) error { return c.postJSON("/api/agent/iis-status", s) }

func (c *Client) PostLinuxSecurityStatus(s LinuxSecurityStatus) error {
	return c.postJSON("/api/agent/linux-security-status", s)
}

func (c *Client) PostPhpStatus(s PhpStatus) error { return c.postJSON("/api/agent/php-status", s) }

func (c *Client) PostPhpLogContent(p phpLogContentPayload) error {
	return c.postJSON("/api/agent/php-log-content", p)
}

func (c *Client) PostHardware(h HardwareInfo) error { return c.postJSON("/api/agent/hardware", h) }

func (c *Client) PostSecurityStatus(s SecurityStatus) error {
	return c.postJSON("/api/agent/security-status", s)
}

func (c *Client) PostNetworkInfo(n NetworkInfo) error {
	return c.postJSON("/api/agent/network-info", n)
}

func (c *Client) PostProcesses(p []ProcessInfo) error {
	return c.postJSON("/api/agent/processes", map[string]interface{}{"processes": p})
}

func (c *Client) PostServices(s []ServiceInfo) error {
	return c.postJSON("/api/agent/services", map[string]interface{}{"services": s})
}

func (c *Client) PostSoftware(s []SoftwareInfo) error {
	return c.postJSON("/api/agent/software", map[string]interface{}{"software": s})
}

func (c *Client) PostLogs(entries []LogEntry) error {
	return c.postJSON("/api/agent/logs", map[string]interface{}{"entries": entries})
}

// weblogEvent is the wire shape for a single forwarded web-server access log line - defined
// here (not in weblog_windows.go) since a future Linux nginx/apache tailer would produce the
// exact same shape, and this file builds on every platform while weblog_windows.go is
// Windows-only.
type weblogEvent struct {
	EventTime      string `json:"eventTime"`
	SourceIP       string `json:"sourceIp"`
	RequestMethod  string `json:"requestMethod"`
	RequestPath    string `json:"requestPath"`
	ResponseStatus *int   `json:"responseStatus"`
	UserAgent      string `json:"userAgent"`
	UserAccount    string `json:"userAccount"`
	TimeTakenMs    *int   `json:"timeTakenMs"`
}

func (c *Client) PostWeblogEvents(siteName string, events []weblogEvent) error {
	return c.postJSON("/api/agent/weblog-events", map[string]interface{}{"siteName": siteName, "events": events})
}

func (c *Client) PostMalwareScan(s MalwareScanResult) error {
	return c.postJSON("/api/agent/malware-scan", s)
}

func (c *Client) PostAutomationResult(r automationResultPayload) error {
	return c.postJSON("/api/agent/automation-result", r)
}

// PostBrowserActivity ships one poll's worth of browser history events (see
// CollectBrowserHistory in browserhistory.go) to the ingest route. Never called unless the
// heartbeat's BrowserActivityIntervalMinutes was non-nil for this device.
func (c *Client) PostBrowserActivity(events []browserActivityEventPayload) error {
	return c.postJSON("/api/agent/browser-activity", map[string]interface{}{"events": events})
}

// PostUsbBlockNotify asks the server to queue a one-off notification for the employee linked
// to this device (delivered next time their chattray companion polls /api/agent/notifications -
// see that route's comment for why this indirection is needed instead of a local OS toast).
// Best-effort by design: a failure here just means the person doesn't see a popup, it must
// never affect whether the device actually gets blocked.
func (c *Client) PostUsbBlockNotify(message string) error {
	return c.postJSON("/api/agent/usb-block-notify", map[string]interface{}{"message": message})
}

// PostFileIntegrityEvent reports one detected watched-file change (or its initial baseline
// capture, or its deletion) to the server - see FileIntegrityChange (fileintegrity.go) and
// /api/agent/file-integrity-event/route.ts.
func (c *Client) PostFileIntegrityEvent(ch FileIntegrityChange) error {
	return c.postJSON("/api/agent/file-integrity-event", map[string]interface{}{
		"filePath":   ch.FilePath,
		"changeType": ch.ChangeType,
		"modifiedBy": ch.ModifiedBy,
		"oldHash":    ch.OldHash,
		"newHash":    ch.NewHash,
		"oldValue":   ch.OldValue,
		"newValue":   ch.NewValue,
	})
}

// AckPowerAction marks the pending reboot/shutdown request fulfilled server-side. Must
// succeed BEFORE the caller executes the actual OS-level command - see run.go and the
// comment in scripts/migrate-power-actions.ts for why that ordering is load-bearing, not
// just tidy bookkeeping.
func (c *Client) AckPowerAction() error {
	return c.postJSON("/api/agent/power-action-ack", map[string]interface{}{})
}

func (c *Client) PostUsbEvent(eventType string, d UsbDeviceInfo) error {
	return c.postJSON("/api/agent/usb-event", map[string]interface{}{
		"eventType":         eventType,
		"deviceName":        d.Name,
		"vendorId":          d.VendorID,
		"productId":         d.ProductID,
		"vendorName":        d.VendorName,
		"serialNumber":      d.SerialNumber,
		"storageCapacityGB": d.CapacityGB,
	})
}

// UploadScreenshot sends plaintext PNG bytes over HTTPS (TLS provides transport
// encryption); the server encrypts at rest on receipt.
func (c *Client) UploadScreenshot(pngBytes []byte, capturedBy string) error {
	req, err := c.authRequest("POST", "/api/agent/screenshot", bytes.NewReader(pngBytes), "image/png")
	if err != nil {
		return err
	}
	req.Header.Set("X-Captured-By", capturedBy)
	req.Header.Set("X-Captured-At", time.Now().UTC().Format(time.RFC3339))
	req.Header.Set("X-Current-User", CurrentLoggedInUser())

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("screenshot upload failed: HTTP %d", resp.StatusCode)
	}
	return nil
}
