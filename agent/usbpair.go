package main

import "strings"

// pairUsbDisks decides which physical disk belongs to which "mass storage" USB device.
// deviceIDs are the PnP device IDs of the devices whose name says mass storage, diskSerials the
// serial numbers of the USB physical disks. The result has one entry per device: the index of
// its disk, or -1 for none.
//
// Not every "mass storage" device is a drive: some headsets and modems expose an empty storage
// interface and have no disk at all. Handing disks out in list order (as before) could credit
// such a device with the capacity of a real drive plugged in beside it - harmless while the
// capacity was only displayed, not once it decides what gets blocked.
//
//  1. A disk whose serial number appears in a device ID belongs to that device (a USB device ID
//     ends in the device's own serial, and the disk reports the same one, often shortened).
//  2. What is left is paired in order only when the counts match exactly, so nothing can be
//     credited to the wrong device. Otherwise the leftovers stay unpaired.
func pairUsbDisks(deviceIDs []string, diskSerials []string) []int {
	out := make([]int, len(deviceIDs))
	for i := range out {
		out[i] = -1
	}
	diskTaken := make([]bool, len(diskSerials))

	for di, serial := range diskSerials {
		s := strings.ToLower(strings.TrimSpace(serial))
		if len(s) < 6 { // too short to identify anything
			continue
		}
		for i, id := range deviceIDs {
			if out[i] != -1 {
				continue
			}
			instance := strings.ToLower(id)
			if cut := strings.LastIndex(instance, `\`); cut >= 0 {
				instance = instance[cut+1:]
			}
			if strings.Contains(instance, s) || (len(instance) >= 6 && strings.Contains(s, instance)) {
				out[i] = di
				diskTaken[di] = true
				break
			}
		}
	}

	var freeDevices, freeDisks []int
	for i, d := range out {
		if d == -1 {
			freeDevices = append(freeDevices, i)
		}
	}
	for di, taken := range diskTaken {
		if !taken {
			freeDisks = append(freeDisks, di)
		}
	}
	if len(freeDevices) == len(freeDisks) {
		for n, i := range freeDevices {
			out[i] = freeDisks[n]
		}
	}
	return out
}
