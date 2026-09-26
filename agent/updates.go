package main

import (
	"log"
	"runtime"
	"sort"
	"sync/atomic"
	"time"
)

// Security & Updates: a read-only, per-OS scan of what is pending, failed or needs a reboot. The
// scan NEVER installs anything (installs are a separate, admin-confirmed request - later phase).
// Platform files (updates_windows.go / _linux.go / _darwin.go / _other.go) only gather raw
// command output; every piece of parsing lives in updates_parse.go as pure functions so it can be
// unit-tested with captured output on any OS.

// Update categories reported to the server.
const (
	catOS          = "os"
	catSecurity    = "security"
	catCritical    = "critical"
	catApplication = "application"
	catPackage     = "package"
	catKernel      = "kernel"
	catFirmware    = "firmware"
	catDriver      = "driver"
	catDefinition  = "definition"
)

// UpdateItem is one pending update.
type UpdateItem struct {
	Key            string  `json:"key"` // stable id: Windows UpdateID, package name, macOS label, fwupd device id
	Title          string  `json:"title"`
	Category       string  `json:"category"`
	Severity       string  `json:"severity"` // critical | high | medium | low | none
	CurrentVersion string  `json:"currentVersion"`
	NewVersion     string  `json:"newVersion"`
	SizeMB         float64 `json:"sizeMB"`
	RequiresReboot bool    `json:"requiresReboot"`
	// IsDisruptive marks updates that must never be installed without explicit administrator
	// confirmation: OS-level, kernel, firmware, critical-severity, or anything needing a reboot.
	IsDisruptive bool `json:"isDisruptive"`
}

// FailedUpdate is an update whose latest install attempt failed (or a package left broken).
type FailedUpdate struct {
	Key   string `json:"key"`
	Title string `json:"title"`
	Error string `json:"error"`
	At    string `json:"at"`
}

// UpdateDefinitions describes the security-definition (antivirus) state where the OS has one.
type UpdateDefinitions struct {
	Name    string `json:"name"`
	Version string `json:"version"`
	AgeDays *int   `json:"ageDays"`
}

// UpdateScan is the full payload posted to /api/agent/update-scan.
type UpdateScan struct {
	ScannedAt       string             `json:"scannedAt"`
	OS              string             `json:"os"`
	Family          string             `json:"family"` // e.g. apt | dnf | yum | zypper | windows-update | softwareupdate
	Supported       bool               `json:"supported"`
	// Complete is false when the "what is pending" search itself failed or timed out; the server must not
	// treat a missing update as installed in that case.
	Complete bool `json:"complete"`
	RebootRequired  bool               `json:"rebootRequired"`
	LastInstalledAt string             `json:"lastInstalledAt"`
	Definitions     *UpdateDefinitions `json:"definitions"`
	Updates         []UpdateItem       `json:"updates"`
	Failed          []FailedUpdate     `json:"failed"`
	Warnings        []string           `json:"warnings"`
	Trigger         string             `json:"trigger"` // scheduled | admin
	RequestID       int                `json:"requestId,omitempty"`
}

// UpdateRequest is one admin-queued job from the heartbeat. Kind "scan" (read-only check) or "install" (approved
// installation of UpdateKeys - see updates_install.go for the safety rules that apply on the device).
type UpdateRequest struct {
	ID              int      `json:"id"`
	Kind            string   `json:"kind"`
	UpdateKeys      []string `json:"updateKeys"`
	AllowDisruptive bool     `json:"allowDisruptive"`
}

var updateScanRunning int32

// RunUpdateScan collects and uploads one scan. Overlapping scans are skipped (a Windows Update
// search can take minutes and must never pile up behind a 30-second heartbeat).
func RunUpdateScan(client *Client, trigger string, requestID int) {
	if !atomic.CompareAndSwapInt32(&updateScanRunning, 0, 1) {
		return
	}
	defer atomic.StoreInt32(&updateScanRunning, 0)

	scan := CollectUpdates()
	scan.Trigger = trigger
	scan.RequestID = requestID
	if err := client.PostUpdateScan(scan); err != nil {
		log.Printf("update scan upload failed: %v", err)
		return
	}
	log.Printf("update scan uploaded: %d pending, %d failed, reboot=%v", len(scan.Updates), len(scan.Failed), scan.RebootRequired)
}

// handlePendingUpdateRequests runs admin-requested scans. Unknown kinds are ignored so a newer
// server can never make an older agent do something it does not understand.
func handlePendingUpdateRequests(client *Client, reqs []UpdateRequest) {
	for _, r := range reqs {
		switch r.Kind {
		case "scan":
			RunUpdateScan(client, "admin", r.ID)
		case "install":
			RunUpdateInstall(client, r)
		}
	}
}

// CollectUpdates runs the platform collector and normalises its result.
func CollectUpdates() UpdateScan {
	s := collectUpdatesPlatform()
	s.ScannedAt = time.Now().UTC().Format(time.RFC3339)
	s.OS = runtime.GOOS
	return normalizeUpdateScan(s)
}

// normalizeUpdateScan de-duplicates by key, fills IsDisruptive and sorts (security first).
func normalizeUpdateScan(s UpdateScan) UpdateScan {
	seen := map[string]bool{}
	out := make([]UpdateItem, 0, len(s.Updates))
	for _, u := range s.Updates {
		if u.Key == "" || seen[u.Key] {
			continue
		}
		seen[u.Key] = true
		if u.Severity == "" {
			u.Severity = "none"
		}
		u.IsDisruptive = isDisruptiveUpdate(u)
		out = append(out, u)
	}
	sort.SliceStable(out, func(i, j int) bool {
		if ri, rj := categoryRank(out[i].Category), categoryRank(out[j].Category); ri != rj {
			return ri < rj
		}
		return out[i].Title < out[j].Title
	})
	s.Updates = out
	if s.Updates == nil {
		s.Updates = []UpdateItem{}
	}
	if s.Failed == nil {
		s.Failed = []FailedUpdate{}
	}
	if s.Warnings == nil {
		s.Warnings = []string{}
	}
	return s
}

func categoryRank(c string) int {
	switch c {
	case catCritical:
		return 0
	case catSecurity:
		return 1
	case catKernel:
		return 2
	case catOS:
		return 3
	case catFirmware:
		return 4
	case catDriver:
		return 5
	case catApplication:
		return 6
	case catPackage:
		return 7
	default:
		return 8
	}
}

// isDisruptiveUpdate: OS-level, kernel and firmware updates, anything critical, and anything that
// needs a reboot must have explicit administrator confirmation before it is ever installed.
func isDisruptiveUpdate(u UpdateItem) bool {
	switch u.Category {
	case catOS, catKernel, catFirmware, catCritical:
		return true
	}
	return u.RequiresReboot || u.Severity == "critical"
}
