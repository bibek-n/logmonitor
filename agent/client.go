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

const AgentVersion = "0.1.0"

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
	OK       bool   `json:"ok"`
	Error    string `json:"error"`
	DeviceID string `json:"deviceId"`
	APIKey   string `json:"apiKey"`
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
	OK                        bool `json:"ok"`
	ScreenshotIntervalMinutes *int `json:"screenshotIntervalMinutes"`
	PrivacyMode               bool `json:"privacyMode"`
	PendingScreenshotRequest  bool `json:"pendingScreenshotRequest"`
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
	req, err := c.authRequest("POST", "/api/agent/heartbeat", nil, "")
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
	CpuPct        float64 `json:"cpuPct"`
	MemPct        float64 `json:"memPct"`
	DiskPct       float64 `json:"diskPct"`
	NetRxMbps     float64 `json:"netRxMbps"`
	NetTxMbps     float64 `json:"netTxMbps"`
	UptimeSeconds int64   `json:"uptimeSeconds"`
}

func (c *Client) PostMetrics(m MetricsPayload) error {
	body, _ := json.Marshal(m)
	req, err := c.authRequest("POST", "/api/agent/metrics", bytes.NewReader(body), "application/json")
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("metrics upload failed: HTTP %d", resp.StatusCode)
	}
	return nil
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
