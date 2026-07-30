package main

import "strings"

// UsbDeviceInfo covers USB *storage* devices specifically — that's what the requested
// fields (serial number, storage capacity) actually describe, as opposed to arbitrary
// USB peripherals like keyboards/mice which have no "capacity". ProductID is populated
// on Windows only (see usb_windows.go) - Linux detection (usb_linux.go, via lsblk) has no
// generic path back to a USB sysfs vendor/product ID, so enforcement (usbpolicy_windows.go)
// is Windows-only too.
type UsbDeviceInfo struct {
	ID           string  `json:"id"` // stable key used to diff insert/removal across polls - the full PNP DeviceID on Windows
	Name         string  `json:"name"`
	VendorID     string  `json:"vendorId"`
	ProductID    string  `json:"productId"`
	VendorName   string  `json:"vendorName"` // resolved company name, e.g. "Alcor Micro" for VID 058F
	SerialNumber string  `json:"serialNumber"`
	CapacityGB   float64 `json:"capacityGB"`
}

// UsbPolicyEntry mirrors one active row from the server's UsbDevicePolicies table (Action =
// 'Block'), as returned in the heartbeat response. A device matches an entry when every
// non-empty field on the entry matches - VendorID+ProductID together identify an exact
// model; SerialNumber alone identifies one physical unit; DeviceNamePattern is a
// case-insensitive substring match against the device's Name.
type UsbPolicyEntry struct {
	VendorID          string `json:"vendorId"`
	ProductID         string `json:"productId"`
	SerialNumber      string `json:"serialNumber"`
	DeviceNamePattern string `json:"deviceNamePattern"`
}

// Matches reports whether d satisfies every non-empty field on the policy entry.
func (e UsbPolicyEntry) Matches(d UsbDeviceInfo) bool {
	if e.VendorID == "" && e.ProductID == "" && e.SerialNumber == "" && e.DeviceNamePattern == "" {
		return false
	}
	if e.VendorID != "" && !strings.EqualFold(e.VendorID, d.VendorID) {
		return false
	}
	if e.ProductID != "" && !strings.EqualFold(e.ProductID, d.ProductID) {
		return false
	}
	if e.SerialNumber != "" && !strings.EqualFold(e.SerialNumber, d.SerialNumber) {
		return false
	}
	if e.DeviceNamePattern != "" && !strings.Contains(strings.ToLower(d.Name), strings.ToLower(e.DeviceNamePattern)) {
		return false
	}
	return true
}
