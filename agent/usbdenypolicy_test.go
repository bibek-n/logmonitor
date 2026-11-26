package main

import (
	"reflect"
	"strings"
	"testing"
)

// Regression: a rule for ONE drive (model + serial) must not become a Windows-level block of
// every drive of that model.
func TestBuildDenyDeviceIDsOnlyWholeModelEntries(t *testing.T) {
	got := buildDenyDeviceIDs([]UsbPolicyEntry{
		{VendorID: "0781", ProductID: "5581"},
		{VendorID: "0781", ProductID: "5581"}, // duplicate
		{VendorID: "0951", ProductID: "1666", SerialNumber: "001A"},
		{VendorID: "13fe", ProductID: "6400", DeviceNamePattern: "kingston"},
		{VendorID: "8564"},
		{DeviceNamePattern: "mass storage"},
	})
	want := []string{`USB\VID_0781&PID_5581`}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

// Regression: the IDs were written as one REG_MULTI_SZ value, which Windows ignores. The policy
// needs a DWORD switch plus a subkey holding one string value per ID.
func TestDenyPolicyScriptUsesDocumentedLayout(t *testing.T) {
	s := denyPolicyScript([]string{`USB\VID_0781&PID_5581`, `USB\VID_0480&PID_B301`})
	for _, must := range []string{
		`$want = @('USB\VID_0781&PID_5581','USB\VID_0480&PID_B301')`,
		`-Name DenyDeviceIDs -Value 1 -PropertyType DWord`,
		`-Name DenyDeviceIDsRetroactive -Value 1 -PropertyType DWord`,
		`$list = Join-Path $path 'DenyDeviceIDs'`,
		`-PropertyType String`,
	} {
		if !strings.Contains(s, must) {
			t.Errorf("script is missing %q", must)
		}
	}
	if strings.Contains(s, "MultiString") {
		t.Error("script must not write a multi-string value")
	}
	// Never recreate the parent key unconditionally: that wipes unrelated values under it.
	if strings.Contains(s, "\nNew-Item -Path $path -Force") {
		t.Error("script recreates the Restrictions key unconditionally")
	}
}

func TestDenyPolicyScriptEmptyListClears(t *testing.T) {
	s := denyPolicyScript(nil)
	if !strings.Contains(s, "$want = @()") {
		t.Fatal("empty list must produce an empty $want")
	}
	if !strings.Contains(s, "Remove-ItemProperty -Path $path -Name DenyDeviceIDsRetroactive") {
		t.Fatal("empty list must clear the policy values")
	}
}

func TestDenyPolicyScriptEscapesQuotes(t *testing.T) {
	if s := denyPolicyScript([]string{`USB\VID_0001&PID_'x'`}); !strings.Contains(s, `'USB\VID_0001&PID_''x'''`) {
		t.Fatal("single quotes must be doubled")
	}
}
