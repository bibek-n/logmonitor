//go:build windows

package main

import (
	"context"
	"encoding/json"
	"os/exec"
	"regexp"
)

type winUsbDiskRow struct {
	Model        string `json:"Model"`
	SerialNumber string `json:"SerialNumber"`
	Size         int64  `json:"Size"`
	PNPDeviceID  string `json:"PNPDeviceID"`
}

type winUsbPnpRow struct {
	Name     string `json:"Name"`
	DeviceID string `json:"DeviceID"`
}

var vidRe = regexp.MustCompile(`VID_([0-9A-Fa-f]{4})`)

// runPowerShellJSON is like runOut but preserves raw bytes for JSON decoding (runOut
// trims/stringifies, which is fine for scalar output but not for a JSON payload) and
// shares the same subprocessTimeout guard so a stuck WMI query can't stall the whole
// agent loop the way an untimed CollectHardwareInfo call once did.
func runPowerShellJSON(cmd string) []byte {
	ctx, cancel := context.WithTimeout(context.Background(), subprocessTimeout)
	defer cancel()
	out, err := exec.CommandContext(ctx, "powershell", "-NoProfile", "-Command", cmd).Output()
	if err != nil {
		return nil
	}
	return out
}

// CollectUsbDevices polls currently attached USB devices via WMI/CIM — the caller
// (run.go) diffs this against the previous poll to emit insert/removal events, since
// Windows has no simple built-in "list of change events since last check" API without a
// more invasive WM_DEVICECHANGE window-message hook.
//
// Two queries, merged:
//  1. Win32_DiskDrive, matched by PNPDeviceID prefix (not just InterfaceType='USB') -
//     many modern USB-C flash drives/external SSDs use UASP and report
//     InterfaceType='SCSI' even though they're physically USB, which silently dropped
//     them from detection entirely.
//  2. Win32_PnPEntity for any device enumerated directly under the USB bus - catches
//     phones, headsets, and other non-storage devices attached via a data-capable
//     cable, which the disk-only query never saw at all. Root hubs/host controllers
//     are excluded so the machine's own fixed USB topology doesn't get reported as a
//     "device", only things actually plugged into it.
func CollectUsbDevices() []UsbDeviceInfo {
	seen := map[string]bool{}
	var devices []UsbDeviceInfo

	diskOut := runPowerShellJSON(
		"@(Get-CimInstance -ClassName Win32_DiskDrive | Where-Object {$_.InterfaceType -eq 'USB' -or $_.PNPDeviceID -like 'USBSTOR*'} | Select-Object Model,SerialNumber,Size,PNPDeviceID) | ConvertTo-Json -Compress")
	var diskRows []winUsbDiskRow
	if diskOut != nil {
		_ = json.Unmarshal(diskOut, &diskRows)
	}
	for _, r := range diskRows {
		vendorID := ""
		if m := vidRe.FindStringSubmatch(r.PNPDeviceID); len(m) == 2 {
			vendorID = m[1]
		}
		id := r.SerialNumber
		if id == "" {
			id = r.PNPDeviceID
		}
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		devices = append(devices, UsbDeviceInfo{
			ID:           id,
			Name:         r.Model,
			VendorID:     vendorID,
			SerialNumber: r.SerialNumber,
			CapacityGB:   float64(r.Size) / (1024 * 1024 * 1024),
		})
	}

	pnpOut := runPowerShellJSON(
		"@(Get-CimInstance -ClassName Win32_PnPEntity | Where-Object {$_.DeviceID -like 'USB\\VID_*' -and $_.Name -notlike '*Root Hub*' -and $_.Name -notlike '*Host Controller*'} | Select-Object Name,DeviceID) | ConvertTo-Json -Compress")
	var pnpRows []winUsbPnpRow
	if pnpOut != nil {
		_ = json.Unmarshal(pnpOut, &pnpRows)
	}
	for _, r := range pnpRows {
		if r.DeviceID == "" || seen[r.DeviceID] {
			continue
		}
		seen[r.DeviceID] = true
		vendorID := ""
		if m := vidRe.FindStringSubmatch(r.DeviceID); len(m) == 2 {
			vendorID = m[1]
		}
		devices = append(devices, UsbDeviceInfo{
			ID:       r.DeviceID,
			Name:     r.Name,
			VendorID: vendorID,
		})
	}

	return devices
}
