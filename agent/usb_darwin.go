//go:build darwin

package main

import (
	"encoding/json"
	"os/exec"
	"strings"
)

// system_profiler's SPUSBDataType is a recursive tree (a hub's _items can themselves be
// hubs), so this struct is defined recursively to walk it - unlike lsblk's flat JSON on
// Linux. A node represents mass storage (what this agent cares about, same "only USB-
// transport block/storage devices, not every peripheral" scope as usb_linux.go) when its
// own Media array is non-empty.
type spUsbNode struct {
	Name      string      `json:"_name"`
	VendorID  string      `json:"vendor_id"`
	ProductID string      `json:"product_id"`
	SerialNum string      `json:"serial_num"`
	Media     []spUsbMedia `json:"Media"`
	Items     []spUsbNode  `json:"_items"`
}

type spUsbMedia struct {
	Name        string `json:"_name"`
	SizeInBytes int64  `json:"size_in_bytes"`
	BsdName     string `json:"bsd_name"`
}

type spUsbOutput struct {
	Buses []spUsbNode `json:"SPUSBDataType"`
}

// parseUsbVendorProductID strips system_profiler's "0x1234  (Vendor Name)" formatting down
// to the bare hex ID, matching the plain "058F"-style ID Windows/Linux both already store.
func parseUsbVendorProductID(raw string) string {
	raw = strings.TrimSpace(raw)
	if idx := strings.IndexByte(raw, ' '); idx != -1 {
		raw = raw[:idx]
	}
	return strings.TrimPrefix(raw, "0x")
}

func walkUsbNode(node spUsbNode, out *[]UsbDeviceInfo) {
	if len(node.Media) > 0 {
		var totalBytes int64
		id := node.SerialNum
		for _, m := range node.Media {
			totalBytes += m.SizeInBytes
			if id == "" {
				id = m.BsdName
			}
		}
		if id == "" {
			id = node.Name
		}
		*out = append(*out, UsbDeviceInfo{
			ID:           id,
			Name:         node.Name,
			VendorID:     parseUsbVendorProductID(node.VendorID),
			ProductID:    parseUsbVendorProductID(node.ProductID),
			SerialNumber: node.SerialNum,
			CapacityGB:   float64(totalBytes) / (1024 * 1024 * 1024),
		})
	}
	for _, child := range node.Items {
		walkUsbNode(child, out)
	}
}

// CollectUsbDevices polls currently attached USB mass-storage devices via system_profiler,
// the standard macOS-native USB inventory source - same cgo-free, shell-out approach as
// usb_linux.go's lsblk call. VendorName is left blank, same as Linux (resolving it would
// need the same OuiVendors-style lookup table this agent doesn't carry locally - the server
// side already does that resolution from VendorID for every platform, see OuiVendors usage
// elsewhere in this app).
func CollectUsbDevices() []UsbDeviceInfo {
	out, err := exec.Command("system_profiler", "SPUSBDataType", "-json").Output()
	if err != nil {
		return nil
	}

	var parsed spUsbOutput
	if err := json.Unmarshal(out, &parsed); err != nil {
		return nil
	}

	var devices []UsbDeviceInfo
	for _, bus := range parsed.Buses {
		walkUsbNode(bus, &devices)
	}
	return devices
}
