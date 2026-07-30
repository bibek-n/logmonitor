package main

import "testing"

func TestUsbPolicyEntryMatches(t *testing.T) {
	kingston := UsbDeviceInfo{
		ID:           `USB\VID_0951&PID_1666\001A`,
		Name:         "Kingston DataTraveler USB Device",
		VendorID:     "0951",
		ProductID:    "1666",
		SerialNumber: "001A",
		CapacityGB:   32,
	}
	sandisk := UsbDeviceInfo{
		ID:           `USB\VID_0781&PID_5591\XYZ`,
		Name:         "SanDisk Ultra USB Device",
		VendorID:     "0781",
		ProductID:    "5591",
		SerialNumber: "XYZ",
		CapacityGB:   64,
	}

	cases := []struct {
		name  string
		entry UsbPolicyEntry
		want  map[string]bool // device.ID -> expected match
	}{
		{
			name:  "empty entry matches nothing",
			entry: UsbPolicyEntry{},
			want:  map[string]bool{kingston.ID: false, sandisk.ID: false},
		},
		{
			name:  "vendor+product pair matches only that exact model",
			entry: UsbPolicyEntry{VendorID: "0951", ProductID: "1666"},
			want:  map[string]bool{kingston.ID: true, sandisk.ID: false},
		},
		{
			name:  "vendor only matches any device from that vendor regardless of product",
			entry: UsbPolicyEntry{VendorID: "0951"},
			want:  map[string]bool{kingston.ID: true, sandisk.ID: false},
		},
		{
			name:  "vendor+product mismatch on product does not match",
			entry: UsbPolicyEntry{VendorID: "0951", ProductID: "9999"},
			want:  map[string]bool{kingston.ID: false, sandisk.ID: false},
		},
		{
			name:  "serial number alone matches only that exact unit",
			entry: UsbPolicyEntry{SerialNumber: "001A"},
			want:  map[string]bool{kingston.ID: true, sandisk.ID: false},
		},
		{
			name:  "case-insensitive matching on vendor/product/serial",
			entry: UsbPolicyEntry{VendorID: "0951", ProductID: "1666", SerialNumber: "001a"},
			want:  map[string]bool{kingston.ID: true, sandisk.ID: false},
		},
		{
			name:  "device name pattern is a case-insensitive substring match",
			entry: UsbPolicyEntry{DeviceNamePattern: "kingston"},
			want:  map[string]bool{kingston.ID: true, sandisk.ID: false},
		},
		{
			name:  "multiple fields on one entry are AND-ed together",
			entry: UsbPolicyEntry{VendorID: "0951", SerialNumber: "wrong-serial"},
			want:  map[string]bool{kingston.ID: false, sandisk.ID: false},
		},
	}

	devices := map[string]UsbDeviceInfo{kingston.ID: kingston, sandisk.ID: sandisk}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			for id, want := range tc.want {
				got := tc.entry.Matches(devices[id])
				if got != want {
					t.Errorf("entry %+v matching device %s: got %v, want %v", tc.entry, id, got, want)
				}
			}
		})
	}
}
