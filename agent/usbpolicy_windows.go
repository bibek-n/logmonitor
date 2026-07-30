//go:build windows

package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const usbPolicyStateFile = "usb-blocked-devices.json"

// usbPolicyStatePath is a small local JSON file tracking which device instance IDs this agent
// has itself disabled via Disable-PnpDevice, so that when a Block entry is later removed, only
// devices *this mechanism* disabled get re-enabled - never a device someone/something else
// disabled for an unrelated reason. Persisted to disk (not just kept in memory) so a policy
// removal is still correctly reversed across an agent restart/update.
func usbPolicyStatePath() string {
	dir := os.Getenv("ProgramData")
	if dir == "" {
		dir = `C:\ProgramData`
	}
	dir = filepath.Join(dir, "LogMonitorAgent")
	_ = os.MkdirAll(dir, 0o755)
	return filepath.Join(dir, usbPolicyStateFile)
}

func loadBlockedState() map[string]bool {
	data, err := os.ReadFile(usbPolicyStatePath())
	if err != nil {
		return map[string]bool{}
	}
	var ids []string
	if err := json.Unmarshal(data, &ids); err != nil {
		return map[string]bool{}
	}
	out := map[string]bool{}
	for _, id := range ids {
		out[id] = true
	}
	return out
}

func saveBlockedState(ids map[string]bool) {
	list := make([]string, 0, len(ids))
	for id := range ids {
		list = append(list, id)
	}
	data, err := json.Marshal(list)
	if err != nil {
		return
	}
	_ = os.WriteFile(usbPolicyStatePath(), data, 0o644)
}

// buildDenyDeviceIDs returns "USB\VID_xxxx&PID_yyyy" strings for policy entries specific
// enough to express as an exact Windows hardware ID (both VendorID and ProductID set) - the
// only shape Windows' own DenyDeviceIDs policy can match against. Serial-number-only or
// name-pattern-only entries can't be expressed this way and are handled purely via the
// currently-connected Disable-PnpDevice path in ApplyUsbPolicy instead.
func buildDenyDeviceIDs(entries []UsbPolicyEntry) []string {
	seen := map[string]bool{}
	var ids []string
	for _, e := range entries {
		if e.VendorID == "" || e.ProductID == "" {
			continue
		}
		id := fmt.Sprintf(`USB\VID_%s&PID_%s`, strings.ToUpper(e.VendorID), strings.ToUpper(e.ProductID))
		if !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	return ids
}

// applyDenyDeviceIdsPolicy writes (or clears) the Windows Device Installation Restriction
// policy - HKLM\SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions\DenyDeviceIDs,
// the standard Microsoft-documented mechanism for blocking specific USB hardware IDs from
// installing - with DenyDeviceIDsRetroactive=1 so it also applies to devices already installed,
// not just future connections. Deliberately never touches AllowDeviceIDs/DenyUnspecified: this
// agent only ever denies the specific IDs an admin listed, it never switches the machine into a
// default-deny-everything-else mode.
func applyDenyDeviceIdsPolicy(ids []string) {
	var script string
	if len(ids) == 0 {
		script = `
$path = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions'
if (Test-Path $path) {
  Remove-ItemProperty -Path $path -Name DenyDeviceIDs -ErrorAction SilentlyContinue
  Remove-ItemProperty -Path $path -Name DenyDeviceIDsRetroactive -ErrorAction SilentlyContinue
}
`
	} else {
		quoted := make([]string, len(ids))
		for i, id := range ids {
			quoted[i] = "'" + strings.ReplaceAll(id, "'", "''") + "'"
		}
		script = fmt.Sprintf(`
$path = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions'
New-Item -Path $path -Force | Out-Null
Set-ItemProperty -Path $path -Name DenyDeviceIDs -Value @(%s) -Type MultiString
Set-ItemProperty -Path $path -Name DenyDeviceIDsRetroactive -Value 1 -Type DWord
`, strings.Join(quoted, ","))
	}
	runPowerShellScript(30*time.Second, script)
}

// setPnpDeviceEnabled runs Disable-PnpDevice/Enable-PnpDevice for one device instance ID.
// Best-effort: failures (device already gone, access denied, etc.) are logged, never fatal -
// this runs unattended on a heartbeat cycle with no human present to intervene.
func setPnpDeviceEnabled(instanceID string, enabled bool) {
	verb := "Disable-PnpDevice"
	if enabled {
		verb = "Enable-PnpDevice"
	}
	script := fmt.Sprintf(`%s -InstanceId '%s' -Confirm:$false -ErrorAction SilentlyContinue`, verb, strings.ReplaceAll(instanceID, "'", "''"))
	runPowerShellScript(30*time.Second, script)
}

// TEMPORARY diagnostic aid for the initial pilot rollout - the agent's own log.Printf output
// goes nowhere retrievable from a Windows Service (LocalSystem, no console, nothing redirects
// stderr), so this appends a plain-text trace of every ApplyUsbPolicy run to a file instead.
// Remove once the pilot's matching/enforcement behavior is confirmed working correctly.
func debugLogUsbPolicy(entries []UsbPolicyEntry, current []UsbDeviceInfo, shouldBlock map[string]UsbDeviceInfo) {
	dir := os.Getenv("ProgramData")
	if dir == "" {
		dir = `C:\ProgramData`
	}
	dir = filepath.Join(dir, "LogMonitorAgent")
	_ = os.MkdirAll(dir, 0o755)
	f, err := os.OpenFile(filepath.Join(dir, "usb-policy-debug.log"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer f.Close()

	fmt.Fprintf(f, "=== %s ===\n", time.Now().Format(time.RFC3339))
	fmt.Fprintf(f, "entries received: %d\n", len(entries))
	for _, e := range entries {
		fmt.Fprintf(f, "  entry: vendor=%q product=%q serial=%q namePattern=%q\n", e.VendorID, e.ProductID, e.SerialNumber, e.DeviceNamePattern)
	}
	fmt.Fprintf(f, "devices currently detected: %d\n", len(current))
	for _, d := range current {
		fmt.Fprintf(f, "  device: id=%q name=%q vendor=%q product=%q serial=%q\n", d.ID, d.Name, d.VendorID, d.ProductID, d.SerialNumber)
		for _, e := range entries {
			fmt.Fprintf(f, "    matches entry(vendor=%q product=%q serial=%q)? %v\n", e.VendorID, e.ProductID, e.SerialNumber, e.Matches(d))
		}
	}
	fmt.Fprintf(f, "shouldBlock count: %d\n\n", len(shouldBlock))
}

// ApplyUsbPolicy is called on every heartbeat with the server's current active Block list
// (see client.go's HeartbeatResponse.UsbBlockList, populated by /api/agent/heartbeat). It:
//  1. Applies/clears the Windows-level DenyDeviceIDs policy for entries specific enough to
//     express as an exact hardware ID (blocks future connections too, not just now).
//  2. Disables any *currently connected* device matching ANY active entry - covers entries
//     that can't be expressed as a Device ID (serial/name-pattern only), and gives immediate
//     effect for VID+PID entries without waiting for a reboot or replug.
//  3. Re-enables any device this same mechanism previously disabled whose matching entry was
//     since removed - never touches a device disabled by anything else.
//
// Deliberately Block-only: there is no "default-deny except Allow-listed" mode, and this
// function never activates one - see the POST /api/admin/usb-control/policies route comment for
// why (blast radius of accidentally disabling every USB device that isn't allow-listed,
// including keyboards/mice, is too high to activate as a side effect of one admin action).
func ApplyUsbPolicy(client *Client, entries []UsbPolicyEntry) {
	applyDenyDeviceIdsPolicy(buildDenyDeviceIDs(entries))

	current := CollectUsbDevices()
	shouldBlock := map[string]UsbDeviceInfo{}
	for _, d := range current {
		for _, e := range entries {
			if e.Matches(d) {
				shouldBlock[d.ID] = d
				break
			}
		}
	}

	debugLogUsbPolicy(entries, current, shouldBlock)

	previouslyBlocked := loadBlockedState()

	for id, d := range shouldBlock {
		if !previouslyBlocked[id] {
			log.Printf("usb policy: disabling %s (%s)", id, d.Name)
			setPnpDeviceEnabled(id, false)
			// NOT notify()/beeep - this agent runs as a Windows Service (LocalSystem,
			// Session 0), which cannot show UI on the logged-in user's desktop at all; a
			// local toast call here would silently do nothing. Routed through the server
			// instead, into the same EmployeeNotifications queue the chattray companion
			// (running IN the user's session) already polls and displays - see
			// api/agent/usb-block-notify/route.ts. Best-effort: a delivery failure must
			// never affect whether the device is actually blocked, which already happened
			// above regardless of this call's outcome.
			deviceLabel := d.Name
			if deviceLabel == "" {
				deviceLabel = "This USB device"
			}
			message := fmt.Sprintf("%s is not allowed on this computer without permission. Contact IT if you need access.", deviceLabel)
			if err := client.PostUsbBlockNotify(message); err != nil {
				log.Printf("usb policy: block notification failed (device still blocked regardless): %v", err)
			}
		}
	}
	for id := range previouslyBlocked {
		if _, stillBlocked := shouldBlock[id]; !stillBlocked {
			log.Printf("usb policy: re-enabling %s (no longer matches an active Block entry)", id)
			setPnpDeviceEnabled(id, true)
		}
	}

	newState := map[string]bool{}
	for id := range shouldBlock {
		newState[id] = true
	}
	saveBlockedState(newState)
}
