package main

import (
	"reflect"
	"testing"
)

const (
	pairFlashID   = `USB\VID_0781&PID_5581\0501802B9C5F9AA5E0728CD0529490F67C52A8249D90CCAEC8BD9A10DAFCAEF2AF5F`
	pairHeadsetID = `USB\VID_4C4A&PID_4155\5&31036E8E&0&4`
	pairOtherID   = `USB\VID_0951&PID_1666\5&1A2B3C4D&0&2`
)

func TestPairUsbDisks(t *testing.T) {
	cases := []struct {
		name    string
		devices []string
		serials []string
		want    []int
	}{
		{"one drive, serial matches (disk reports a shortened serial)", []string{pairFlashID}, []string{"0501802b9c5f9aa5e072"}, []int{0}},
		{"one drive, no usable serial: counts match, pair in order", []string{pairOtherID}, []string{""}, []int{0}},
		// Regression: the headset is listed first and used to be handed the drive's disk.
		{"headset listed before the drive", []string{pairHeadsetID, pairFlashID}, []string{"0501802b9c5f9aa5e072"}, []int{-1, 0}},
		{"headset and a drive with no usable serial: ambiguous, pair nothing", []string{pairHeadsetID, pairOtherID}, []string{""}, []int{-1, -1}},
		{"headset alone has no disk", []string{pairHeadsetID}, nil, []int{-1}},
		{"two drives, one by serial, the other by elimination", []string{pairOtherID, pairFlashID}, []string{"0501802b9c5f9aa5e072", "XYZ"}, []int{1, 0}},
		{"more disks than devices: pair nothing by position", []string{pairOtherID}, []string{"", ""}, []int{-1}},
		{"nothing plugged in", nil, nil, []int{}},
	}
	for _, c := range cases {
		if got := pairUsbDisks(c.devices, c.serials); !reflect.DeepEqual(got, c.want) {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
	}
}
