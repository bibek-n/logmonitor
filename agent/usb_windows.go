//go:build windows

package main

import (
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

var vidRe = regexp.MustCompile(`VID_([0-9A-Fa-f]{4})`)

// CollectUsbDevices polls currently attached USB *storage* devices via WMI/CIM — the
// caller (run.go) diffs this against the previous poll to emit insert/removal events,
// since Windows has no simple built-in "list of change events since last check" API
// without a more invasive WM_DEVICECHANGE window-message hook.
func CollectUsbDevices() []UsbDeviceInfo {
	out, err := exec.Command("powershell", "-NoProfile", "-Command",
		"@(Get-CimInstance -ClassName Win32_DiskDrive | Where-Object {$_.InterfaceType -eq 'USB'} | Select-Object Model,SerialNumber,Size,PNPDeviceID) | ConvertTo-Json -Compress").Output()
	if err != nil {
		return nil
	}

	var rows []winUsbDiskRow
	if err := json.Unmarshal(out, &rows); err != nil {
		return nil
	}

	var devices []UsbDeviceInfo
	for _, r := range rows {
		vendorID := ""
		if m := vidRe.FindStringSubmatch(r.PNPDeviceID); len(m) == 2 {
			vendorID = m[1]
		}
		id := r.SerialNumber
		if id == "" {
			id = r.PNPDeviceID
		}
		devices = append(devices, UsbDeviceInfo{
			ID:           id,
			Name:         r.Model,
			VendorID:     vendorID,
			SerialNumber: r.SerialNumber,
			CapacityGB:   float64(r.Size) / (1024 * 1024 * 1024),
		})
	}
	return devices
}
