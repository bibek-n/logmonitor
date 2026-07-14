//go:build windows

package main

import (
	"context"
	"encoding/json"
	"os/exec"
	"regexp"
	"strings"
)

type winUsbPnpRow struct {
	Name         string `json:"Name"`
	Manufacturer string `json:"Manufacturer"`
	DeviceID     string `json:"DeviceID"`
}

type winPhysicalDiskRow struct {
	FriendlyName string `json:"FriendlyName"`
	SerialNumber string `json:"SerialNumber"`
	Size         int64  `json:"Size"`
}

var (
	vidRe         = regexp.MustCompile(`VID_([0-9A-Fa-f]{4})`)
	massStorageRe = regexp.MustCompile(`(?i)mass storage`)
)

// usbVendorNames maps a USB-IF vendor ID (the VID_xxxx token from a device's PNP
// DeviceID) to its registered company name. Windows' own Manufacturer field is
// unreliable for this - generic/composite device drivers usually report a placeholder
// like "(Standard USB Host Controller)" instead of the actual silicon vendor, which is
// what an admin actually wants to see (whose flash drive is this). Not exhaustive - the
// full USB-IF list runs to thousands of entries - but covers the vendors most likely to
// show up on a real corporate workstation (storage controllers, PC/peripheral OEMs,
// phone makers).
var usbVendorNames = map[string]string{
	"03f0": "HP",
	"03fd": "Microsemi",
	"0424": "SMSC (Microchip)",
	"0451": "Texas Instruments",
	"046d": "Logitech",
	"0489": "Foxconn / Hon Hai",
	"04b3": "IBM",
	"04b4": "Cypress Semiconductor",
	"04c5": "Fujitsu",
	"04ca": "Lite-On",
	"04d9": "Holtek Semiconductor",
	"04e8": "Samsung Electronics",
	"04f2": "Chicony Electronics",
	"04f3": "Elan Microelectronics",
	"0502": "Acer",
	"050d": "Belkin",
	"056a": "Wacom",
	"058f": "Alcor Micro",
	"05ac": "Apple",
	"05c6": "Qualcomm",
	"05e3": "Genesys Logic",
	"067b": "Prolific Technology",
	"06cb": "Synaptics",
	"0781": "SanDisk",
	"08ff": "AuthenTec",
	"090c": "Silicon Motion",
	"0930": "Toshiba",
	"0951": "Kingston Technology",
	"0a12": "Cambridge Silicon Radio",
	"0a5c": "Broadcom",
	"0b05": "ASUSTeK Computer",
	"0b95": "ASIX Electronics",
	"0bb4": "HTC",
	"0bc2": "Seagate",
	"0bda": "Realtek Semiconductor",
	"0c45": "Microdia",
	"0d8c": "C-Media Electronics",
	"0e0f": "VMware Virtual USB",
	"0e8d": "MediaTek",
	"10c4": "Silicon Labs",
	"1004": "LG Electronics",
	"1050": "Yubico",
	"1058": "Western Digital",
	"125f": "A-DATA Technology",
	"12d1": "Huawei Technologies",
	"152d": "JMicron Technology",
	"154b": "PNY Technologies",
	"1462": "Micro-Star International (MSI)",
	"1532": "Razer",
	"18a5": "Verbatim",
	"18d1": "Google",
	"1a86": "QinHeng Electronics (CH340/341)",
	"1b1c": "Corsair",
	"1c4f": "SiGma Micro",
	"1d6b": "Linux Foundation (USB hub)",
	"1f75": "Innostor Technology",
	"2001": "D-Link",
	"2109": "VIA Labs",
	"22b8": "Motorola Mobility",
	"2537": "Netac Technology",
	"2717": "Xiaomi",
	"27c6": "Goodix",
	"3554": "Union Memory",
	"413c": "Dell",
	"5986": "Azurewave Technologies",
	"8087": "Intel",
	"8564": "Transcend Information",
}

// runPowerShellJSON is like runOut but preserves raw bytes for JSON decoding (runOut
// trims/stringifies, which is fine for scalar output but not for a JSON payload) and
// shares the same subprocessTimeout guard so a stuck WMI/CIM query can't stall the whole
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

// cleanManufacturer discards Windows' generic driver-provided placeholders (e.g.
// "(Standard USB Host Controller)", "(Standard system devices)") which name a driver
// class, not an actual company - a caller falling back to this field should prefer
// "unknown" over a placeholder that reads like a real answer but isn't one.
func cleanManufacturer(m string) string {
	if strings.HasPrefix(m, "(Standard") {
		return ""
	}
	return m
}

// CollectUsbDevices polls currently attached USB devices via WMI/CIM - the caller
// (run.go) diffs this against the previous poll to emit insert/removal events, since
// Windows has no simple built-in "list of change events since last check" API without a
// more invasive WM_DEVICECHANGE window-message hook.
//
// Primary detection is Win32_PnPEntity for any device enumerated directly under the USB
// bus (root hubs/host controllers excluded) - this is what actually works under the
// LocalSystem context the agent's Windows Service runs as. Win32_DiskDrive, the more
// obvious API for storage devices, was tried first but confirmed (via a live test
// against a real USB flash drive, run as SYSTEM via a scheduled task to match the
// service's exact security context) to return zero rows for a device that same query
// finds fine in an interactive admin session - so it's not used at all here.
// Get-PhysicalDisk (the modern Storage Management API, already relied on elsewhere in
// this file's package for disk health) *does* work under SYSTEM and is used to enrich
// whichever PnP entry looks like a mass-storage device with real capacity/model, matched
// positionally - correct for the overwhelmingly common case of one USB drive at a time;
// with several simultaneous drives the extras simply go unenriched rather than risk
// attaching the wrong capacity to the wrong device.
func CollectUsbDevices() []UsbDeviceInfo {
	physOut := runPowerShellJSON(
		"@(Get-PhysicalDisk | Where-Object {$_.BusType -eq 'USB'} | Select-Object FriendlyName,SerialNumber,Size) | ConvertTo-Json -Compress")
	var physRows []winPhysicalDiskRow
	if physOut != nil {
		_ = json.Unmarshal(physOut, &physRows)
	}

	pnpOut := runPowerShellJSON(
		"@(Get-CimInstance -ClassName Win32_PnPEntity | Where-Object {$_.DeviceID -like 'USB\\VID_*' -and $_.Name -notlike '*Root Hub*' -and $_.Name -notlike '*Host Controller*'} | Select-Object Name,Manufacturer,DeviceID) | ConvertTo-Json -Compress")
	var pnpRows []winUsbPnpRow
	if pnpOut != nil {
		_ = json.Unmarshal(pnpOut, &pnpRows)
	}

	seen := map[string]bool{}
	var devices []UsbDeviceInfo
	physIdx := 0

	for _, r := range pnpRows {
		if r.DeviceID == "" || seen[r.DeviceID] {
			continue
		}
		seen[r.DeviceID] = true

		vendorID := ""
		if m := vidRe.FindStringSubmatch(r.DeviceID); len(m) == 2 {
			vendorID = strings.ToLower(m[1])
		}
		vendorName := usbVendorNames[vendorID]
		if vendorName == "" {
			vendorName = cleanManufacturer(r.Manufacturer)
		}

		name := r.Name
		var capacityGB float64
		var serial string
		if massStorageRe.MatchString(r.Name) && physIdx < len(physRows) {
			p := physRows[physIdx]
			physIdx++
			if p.FriendlyName != "" {
				name = p.FriendlyName
			}
			capacityGB = float64(p.Size) / (1024 * 1024 * 1024)
			serial = p.SerialNumber
		}

		devices = append(devices, UsbDeviceInfo{
			ID:           r.DeviceID,
			Name:         name,
			VendorID:     vendorID,
			VendorName:   vendorName,
			SerialNumber: serial,
			CapacityGB:   capacityGB,
		})
	}

	return devices
}
