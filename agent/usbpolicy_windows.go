//go:build windows

package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
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

// loadBlockedState reads the devices this agent has disabled, each with the details it had
// when it was disabled. Older versions stored a plain list of IDs - those load as entries that
// carry only the ID.
func loadBlockedState() map[string]UsbDeviceInfo {
	out := map[string]UsbDeviceInfo{}
	data, err := os.ReadFile(usbPolicyStatePath())
	if err != nil {
		return out
	}
	var devices []UsbDeviceInfo
	if err := json.Unmarshal(data, &devices); err == nil {
		for _, d := range devices {
			if d.ID != "" {
				out[d.ID] = d
			}
		}
		return out
	}
	var ids []string
	if err := json.Unmarshal(data, &ids); err == nil {
		for _, id := range ids {
			out[id] = UsbDeviceInfo{ID: id}
		}
	}
	return out
}

func saveBlockedState(devices map[string]UsbDeviceInfo) {
	list := make([]UsbDeviceInfo, 0, len(devices))
	for id, d := range devices {
		d.ID = id
		list = append(list, d)
	}
	data, err := json.Marshal(list)
	if err != nil {
		return
	}
	_ = os.WriteFile(usbPolicyStatePath(), data, 0o644)
}

// applyDenyDeviceIdsPolicy makes the Windows Device Installation Restriction policy match ids
// (see denyPolicyScript in usbdenypolicy.go for the registry layout and why the old one never
// took effect). Deliberately never touches AllowDeviceIDs/DenyUnspecified: this agent only ever
// denies the specific IDs an admin listed, it never switches the machine into a
// default-deny-everything-else mode.
func applyDenyDeviceIdsPolicy(ids []string) {
	runPowerShellScript(45*time.Second, denyPolicyScript(ids))
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
func debugLogUsbPolicy(policy UsbPolicy, current []UsbDeviceInfo, plan usbEnforcementPlan) {
	entries := policy.Entries
	dir := os.Getenv("ProgramData")
	if dir == "" {
		dir = `C:\ProgramData`
	}
	dir = filepath.Join(dir, "LogMonitorAgent")
	_ = os.MkdirAll(dir, 0o755)
	tracePath := filepath.Join(dir, "usb-policy-debug.log")
	// Start over once the trace passes 2 MB - it had grown to several MB on a pilot PC.
	if st, err := os.Stat(tracePath); err == nil && st.Size() > 2*1024*1024 {
		_ = os.Remove(tracePath)
	}
	f, err := os.OpenFile(tracePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer f.Close()

	fmt.Fprintf(f, "=== %s ===\n", time.Now().Format(time.RFC3339))
	fmt.Fprintf(f, "entries received: %d, block all storage: %v\n", len(entries), policy.BlockAllStorage)
	for _, e := range entries {
		fmt.Fprintf(f, "  entry: vendor=%q product=%q serial=%q namePattern=%q\n", e.VendorID, e.ProductID, e.SerialNumber, e.DeviceNamePattern)
	}
	fmt.Fprintf(f, "devices currently detected: %d\n", len(current))
	for _, d := range current {
		fmt.Fprintf(f, "  device: id=%q name=%q vendor=%q product=%q serial=%q capacityGB=%.1f blocked=%v\n", d.ID, d.Name, d.VendorID, d.ProductID, d.SerialNumber, d.CapacityGB, policy.Blocks(d))
	}
	fmt.Fprintf(f, "blocked: %d, disabling now: %d, enabling now: %d\n\n", len(plan.State), len(plan.Disable), len(plan.Enable))
}

// ApplyUsbPolicy is called on every heartbeat with the server's current block policy (see
// client.go's HeartbeatResponse.UsbBlockList / UsbBlockAllStorage). It:
//  1. Remembers the policy, so the fast USB poll can enforce it between heartbeats.
//  2. Applies/clears the Windows-level DenyDeviceIDs policy for whole-model entries.
//  3. Runs one enforcement pass over the devices connected right now.
//
// Deliberately Block-only: there is no "default-deny except Allow-listed" mode, and this
// function never activates one - see the POST /api/admin/usb-control/policies route comment for
// why (blast radius of accidentally disabling every USB device that isn't allow-listed,
// including keyboards/mice, is too high to activate as a side effect of one admin action).
func ApplyUsbPolicy(client *Client, policy UsbPolicy) {
	rememberUsbPolicy(policy)
	applyDenyDeviceIdsPolicy(buildDenyDeviceIDs(policy.Entries))
	enforceUsbPolicy(client, policy, CollectUsbDevices(), true)
}

// EnforceUsbPolicyOnPoll runs an enforcement pass from the fast USB poll, with the device list
// that poll has just collected. This is what stops a blocked drive within one poll interval of
// being plugged in, instead of up to a full heartbeat later. Does nothing until the first
// heartbeat has delivered a policy.
func EnforceUsbPolicyOnPoll(client *Client, current []UsbDeviceInfo) {
	policy, known := recallUsbPolicy()
	if !known {
		return
	}
	enforceUsbPolicy(client, policy, current, false)
}

// The heartbeat pass and the poll pass must not interleave: both read, act on and rewrite the
// same state file.
var usbEnforceMu sync.Mutex

// enforceUsbPolicy disables every connected device the policy blocks and gives back any device
// this agent disabled earlier that is no longer blocked - never one disabled by anything else.
// See planUsbEnforcement for the rules.
func enforceUsbPolicy(client *Client, policy UsbPolicy, current []UsbDeviceInfo, trace bool) {
	usbEnforceMu.Lock()
	defer usbEnforceMu.Unlock()

	tracked := loadBlockedState()
	plan := planUsbEnforcement(policy, current, tracked)
	if trace {
		debugLogUsbPolicy(policy, current, plan)
	}

	for _, d := range plan.Disable {
		log.Printf("usb policy: disabling %s (%s)", d.ID, d.Name)
		setPnpDeviceEnabled(d.ID, false)
		// NOT notify()/beeep - this agent runs as a Windows Service (LocalSystem, Session 0),
		// which cannot show UI on the logged-in user's desktop at all; a local toast call here
		// would silently do nothing. Routed through the server instead, into the same
		// EmployeeNotifications queue the chattray companion (running IN the user's session)
		// already polls and displays - see api/agent/usb-block-notify/route.ts. Best-effort:
		// a delivery failure must never affect whether the device is actually blocked, which
		// already happened above regardless of this call's outcome.
		deviceLabel := d.Name
		if deviceLabel == "" {
			deviceLabel = "This USB device"
		}
		message := fmt.Sprintf("%s is not allowed on this computer without permission. Contact IT if you need access.", deviceLabel)
		if err := client.PostUsbBlockNotify(message); err != nil {
			log.Printf("usb policy: block notification failed (device still blocked regardless): %v", err)
		}
	}
	for _, id := range plan.Enable {
		log.Printf("usb policy: re-enabling %s (no longer blocked)", id)
		setPnpDeviceEnabled(id, true)
	}

	if len(plan.Disable) > 0 || len(plan.Enable) > 0 || len(plan.State) != len(tracked) {
		saveBlockedState(plan.State)
	}
}
