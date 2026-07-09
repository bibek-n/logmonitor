//go:build linux

package main

import (
	"encoding/json"
	"os/exec"
)

type lsblkOutput struct {
	BlockDevices []lsblkDevice `json:"blockdevices"`
}

type lsblkDevice struct {
	Name   string `json:"name"`
	Tran   string `json:"tran"`
	Size   int64  `json:"size"`
	Serial string `json:"serial"`
	Model  string `json:"model"`
}

// CollectUsbDevices polls currently attached USB-transport block devices via lsblk
// (util-linux, present on essentially every Ubuntu/Debian/RHEL install). Vendor ID is
// left blank on Linux — resolving a block device back to its USB sysfs vendor ID isn't
// a simple generic path, unlike the Windows PNPDeviceID which encodes it directly.
func CollectUsbDevices() []UsbDeviceInfo {
	out, err := exec.Command("lsblk", "-b", "-o", "NAME,TRAN,SIZE,SERIAL,MODEL", "-J").Output()
	if err != nil {
		return nil
	}

	var parsed lsblkOutput
	if err := json.Unmarshal(out, &parsed); err != nil {
		return nil
	}

	var devices []UsbDeviceInfo
	for _, d := range parsed.BlockDevices {
		if d.Tran != "usb" {
			continue
		}
		id := d.Serial
		if id == "" {
			id = d.Name
		}
		devices = append(devices, UsbDeviceInfo{
			ID:           id,
			Name:         d.Model,
			SerialNumber: d.Serial,
			CapacityGB:   float64(d.Size) / (1024 * 1024 * 1024),
		})
	}
	return devices
}
