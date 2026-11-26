package main

import (
	"reflect"
	"sort"
	"testing"
)

var (
	testFlash    = UsbDeviceInfo{ID: `USB\VID_0781&PID_5581\AAA`, Name: "USB SanDisk 3.2Gen1", VendorID: "0781", ProductID: "5581", SerialNumber: "aaa", CapacityGB: 57.3}
	testKeyboard = UsbDeviceInfo{ID: `USB\VID_413C&PID_2113\1`, Name: "USB Input Device", VendorID: "413c", ProductID: "2113"}
	testHeadset  = UsbDeviceInfo{ID: `USB\VID_4C4A&PID_4155\2`, Name: "USB Mass Storage Device", VendorID: "4c4a", ProductID: "4155"}
	testPhone    = UsbDeviceInfo{ID: `USB\VID_05AC&PID_12A8\3`, Name: "Apple iPhone", VendorID: "05ac", ProductID: "12a8"}
)

func ids(ds []UsbDeviceInfo) []string {
	out := []string{}
	for _, d := range ds {
		out = append(out, d.ID)
	}
	sort.Strings(out)
	return out
}

func keys(m map[string]UsbDeviceInfo) []string {
	out := []string{}
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func TestBlockAllStorageOnlyHitsDevicesWithADisk(t *testing.T) {
	p := UsbPolicy{BlockAllStorage: true}
	if !p.Blocks(testFlash) {
		t.Error("a flash drive must be blocked")
	}
	for _, d := range []UsbDeviceInfo{testKeyboard, testHeadset, testPhone} {
		if p.Blocks(d) {
			t.Errorf("%s must not be blocked", d.Name)
		}
	}
	if (UsbPolicy{}).Blocks(testFlash) {
		t.Error("an empty policy blocks nothing")
	}
}

func TestPlanDisablesANewlyPluggedDrive(t *testing.T) {
	plan := planUsbEnforcement(UsbPolicy{BlockAllStorage: true}, []UsbDeviceInfo{testKeyboard, testFlash, testHeadset}, map[string]UsbDeviceInfo{})
	if got := ids(plan.Disable); !reflect.DeepEqual(got, []string{testFlash.ID}) {
		t.Fatalf("disable = %v", got)
	}
	if len(plan.Enable) != 0 || !reflect.DeepEqual(keys(plan.State), []string{testFlash.ID}) {
		t.Fatalf("enable = %v state = %v", plan.Enable, keys(plan.State))
	}
}

// Regression: a disabled drive has no disk any more, so it reports capacity 0 and a generic
// name. Judged by that it would be handed back and blocked again on every pass.
func TestPlanKeepsADisabledDriveBlocked(t *testing.T) {
	disabledNow := UsbDeviceInfo{ID: testFlash.ID, Name: "USB Mass Storage Device", VendorID: "0781", ProductID: "5581"}
	tracked := map[string]UsbDeviceInfo{testFlash.ID: testFlash}
	plan := planUsbEnforcement(UsbPolicy{BlockAllStorage: true}, []UsbDeviceInfo{disabledNow}, tracked)
	if len(plan.Disable) != 0 || len(plan.Enable) != 0 {
		t.Fatalf("nothing should change: disable=%v enable=%v", ids(plan.Disable), plan.Enable)
	}
	if plan.State[testFlash.ID].CapacityGB != testFlash.CapacityGB {
		t.Fatal("the remembered details must be kept")
	}
}

func TestPlanGivesTheDriveBackWhenTheBlockIsLifted(t *testing.T) {
	tracked := map[string]UsbDeviceInfo{testFlash.ID: testFlash}
	plan := planUsbEnforcement(UsbPolicy{}, []UsbDeviceInfo{{ID: testFlash.ID, Name: "USB Mass Storage Device", VendorID: "0781", ProductID: "5581"}}, tracked)
	if !reflect.DeepEqual(plan.Enable, []string{testFlash.ID}) || len(plan.State) != 0 {
		t.Fatalf("enable = %v state = %v", plan.Enable, keys(plan.State))
	}
}

// Regression: lifting the block while the drive is unplugged used to forget it, leaving it
// disabled on that machine for good.
func TestPlanRemembersAnUnpluggedDriveUntilItReturns(t *testing.T) {
	tracked := map[string]UsbDeviceInfo{testFlash.ID: testFlash}

	away := planUsbEnforcement(UsbPolicy{}, []UsbDeviceInfo{testKeyboard}, tracked)
	if len(away.Enable) != 0 || !reflect.DeepEqual(keys(away.State), []string{testFlash.ID}) {
		t.Fatalf("while away: enable = %v state = %v", away.Enable, keys(away.State))
	}

	back := planUsbEnforcement(UsbPolicy{}, []UsbDeviceInfo{{ID: testFlash.ID, Name: "USB Mass Storage Device"}}, away.State)
	if !reflect.DeepEqual(back.Enable, []string{testFlash.ID}) || len(back.State) != 0 {
		t.Fatalf("on return: enable = %v state = %v", back.Enable, keys(back.State))
	}
}

func TestPlanDoesNotDisableAgainOnReplugWhileStillBlocked(t *testing.T) {
	tracked := map[string]UsbDeviceInfo{testFlash.ID: testFlash}
	plan := planUsbEnforcement(UsbPolicy{BlockAllStorage: true}, []UsbDeviceInfo{{ID: testFlash.ID, Name: "USB Mass Storage Device"}}, tracked)
	if len(plan.Disable) != 0 || len(plan.Enable) != 0 || len(plan.State) != 1 {
		t.Fatalf("disable=%v enable=%v state=%v", ids(plan.Disable), plan.Enable, keys(plan.State))
	}
}

// An entry read from the old state file has only an ID - it is judged by what is plugged in now.
func TestPlanHandlesOldStateEntries(t *testing.T) {
	tracked := map[string]UsbDeviceInfo{testFlash.ID: {ID: testFlash.ID}}
	p := UsbPolicy{Entries: []UsbPolicyEntry{{VendorID: "0781", ProductID: "5581"}}}
	plan := planUsbEnforcement(p, []UsbDeviceInfo{{ID: testFlash.ID, Name: "USB Mass Storage Device", VendorID: "0781", ProductID: "5581"}}, tracked)
	if len(plan.Disable) != 0 || len(plan.Enable) != 0 || len(plan.State) != 1 {
		t.Fatalf("disable=%v enable=%v state=%v", ids(plan.Disable), plan.Enable, keys(plan.State))
	}
}
