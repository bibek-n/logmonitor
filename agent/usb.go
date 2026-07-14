package main

// UsbDeviceInfo covers USB *storage* devices specifically — that's what the requested
// fields (serial number, storage capacity) actually describe, as opposed to arbitrary
// USB peripherals like keyboards/mice which have no "capacity". Detection/audit only —
// no allow/block enforcement (deferred pending its own design pass, since blocking
// needs real OS policy integration, not just event detection).
type UsbDeviceInfo struct {
	ID           string  `json:"id"` // stable key used to diff insert/removal across polls
	Name         string  `json:"name"`
	VendorID     string  `json:"vendorId"`
	VendorName   string  `json:"vendorName"` // resolved company name, e.g. "Alcor Micro" for VID 058F
	SerialNumber string  `json:"serialNumber"`
	CapacityGB   float64 `json:"capacityGB"`
}
