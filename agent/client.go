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
	OK                        bool            `json:"ok"`
	ScreenshotIntervalMinutes *int            `json:"screenshotIntervalMinutes"`
	PrivacyMode               bool            `json:"privacyMode"`
	PendingScreenshotRequest  bool            `json:"pendingScreenshotRequest"`
	PendingMalwareScanRequest bool            `json:"pendingMalwareScanRequest"`
	PendingPhpLogRequests     []PhpLogRequest `json:"pendingPhpLogRequests"`
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
	body, _ := json.Marshal(map[string]string{"agentVersion": AgentVersion, "currentUser": CurrentLoggedInUser()})
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

func (c *Client) PostMalwareScan(s MalwareScanResult) error {
	return c.postJSON("/api/agent/malware-scan", s)
}

func (c *Client) PostUsbEvent(eventType string, d UsbDeviceInfo) error {
	return c.postJSON("/api/agent/usb-event", map[string]interface{}{
		"eventType":         eventType,
		"deviceName":        d.Name,
		"vendorId":          d.VendorID,
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
