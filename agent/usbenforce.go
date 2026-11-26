package main

import "sync"

// UsbPolicy is everything the server asked this machine to block.
type UsbPolicy struct {
	// Entries are the specific rules (model, serial number, name) - see UsbPolicyEntry.
	Entries []UsbPolicyEntry
	// BlockAllStorage blocks every USB storage device (flash drives, external disks) whatever
	// its model, so a drive nobody has seen before is stopped too. "Storage" means the device
	// came with a real disk (CapacityGB > 0): keyboards, mice, headsets and phones in
	// file-transfer mode never have one.
	BlockAllStorage bool
}

// Blocks reports whether d must be disabled under this policy.
func (p UsbPolicy) Blocks(d UsbDeviceInfo) bool {
	if p.BlockAllStorage && d.CapacityGB > 0 {
		return true
	}
	for _, e := range p.Entries {
		if e.Matches(d) {
			return true
		}
	}
	return false
}

// usbEnforcementPlan is what one enforcement pass must do.
type usbEnforcementPlan struct {
	Disable []UsbDeviceInfo          // newly matched - disable now
	Enable  []string                 // disabled by this agent earlier, no longer blocked - enable now
	State   map[string]UsbDeviceInfo // what to remember as "disabled by this agent"
}

// planUsbEnforcement decides, without touching the system, what to disable and what to give back.
//
// tracked holds the devices this agent disabled earlier, each with the details it had at that
// moment. Those remembered details - not the current ones - decide whether a tracked device is
// still blocked: once disabled, a drive loses its disk (so its capacity reads 0) and falls back
// to a generic name, and judging it by that would hand it straight back, only to block it again
// on the next pass.
//
// A tracked device that is unplugged stays tracked. Windows keeps it disabled while it is away
// and it cannot be enabled until it is present again; forgetting it would leave the drive dead
// on this machine for good if the block was lifted in the meantime.
func planUsbEnforcement(p UsbPolicy, current []UsbDeviceInfo, tracked map[string]UsbDeviceInfo) usbEnforcementPlan {
	plan := usbEnforcementPlan{State: map[string]UsbDeviceInfo{}}
	present := map[string]bool{}

	for _, d := range current {
		present[d.ID] = true
		judged := d
		remembered, wasTracked := tracked[d.ID]
		// An entry read from the old state file carries only the ID - nothing to judge by.
		if wasTracked && (remembered.Name != "" || remembered.VendorID != "") {
			judged = remembered
		}
		if !p.Blocks(judged) {
			continue
		}
		judged.ID = d.ID
		plan.State[d.ID] = judged
		if !wasTracked {
			plan.Disable = append(plan.Disable, d)
		}
	}

	for id, remembered := range tracked {
		if _, kept := plan.State[id]; kept {
			continue
		}
		if present[id] {
			plan.Enable = append(plan.Enable, id)
			continue
		}
		plan.State[id] = remembered // away: decide again when it is plugged back in
	}
	return plan
}

// The policy from the last heartbeat, kept so the fast USB poll (every few seconds) can block a
// drive the moment it shows up instead of waiting for the next heartbeat.
var (
	lastUsbPolicyMu  sync.Mutex
	lastUsbPolicy    UsbPolicy
	lastUsbPolicySet bool
)

func rememberUsbPolicy(p UsbPolicy) {
	lastUsbPolicyMu.Lock()
	lastUsbPolicy = p
	lastUsbPolicySet = true
	lastUsbPolicyMu.Unlock()
}

// recallUsbPolicy returns the last policy, and false until the first heartbeat has delivered one -
// before that nothing is known, so nothing may be blocked or handed back.
func recallUsbPolicy() (UsbPolicy, bool) {
	lastUsbPolicyMu.Lock()
	defer lastUsbPolicyMu.Unlock()
	return lastUsbPolicy, lastUsbPolicySet
}
