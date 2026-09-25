package main

import (
	"strings"
	"testing"
)

// Fixtures are captured/representative output of each tool; only the parsers are exercised here.

func TestParseWindowsUpdateOutput(t *testing.T) {
	out := strings.Join([]string{
		"U\tguid-1\t2024-06 Cumulative Update for Windows 11 (KB5039212)\tSecurity Updates;Windows 11\tCritical\t5039212\t412.5\t1\t1",
		"U\tguid-2\tMicrosoft Defender Antivirus Security Intelligence Update (KB2267602)\tDefinition Updates;Microsoft Defender Antivirus\t\t2267602\t1.2\t0\t1",
		"U\tguid-3\tIntel - System - 2.1.0.5\tDrivers\t\t\t3.0\t0\t2",
		"U\tguid-4\tUpdate for Microsoft Edge (KB0000)\tMicrosoft Edge\tModerate\t\t80\t0\t1",
		"U\tguid-5\tDell Latitude System Firmware Update\tFirmware;Drivers\t\t\t5\t1\t2",
		"F\t2024-05 .NET Update (KB5038000)\t4\t0x80070643\t2024-05-14T10:00:00Z",
		"L\t2024-06-12T03:00:00Z",
		"D\t1.413.85.0\t2",
		"E\thistory: something minor",
	}, "\n")
	s := parseWindowsUpdateOutput(out)
	if !s.Complete || !s.Supported {
		t.Fatalf("complete/supported = %v/%v", s.Complete, s.Supported)
	}
	if len(s.Updates) != 5 {
		t.Fatalf("updates = %d, want 5", len(s.Updates))
	}
	want := map[string]string{"guid-1": catSecurity, "guid-2": catDefinition, "guid-3": catDriver, "guid-4": catApplication, "guid-5": catFirmware}
	for _, u := range s.Updates {
		if u.Category != want[u.Key] {
			t.Errorf("%s category = %s, want %s", u.Key, u.Category, want[u.Key])
		}
	}
	if s.Updates[0].Severity != "critical" || s.Updates[0].NewVersion != "KB5039212" || !s.Updates[0].RequiresReboot || s.Updates[0].SizeMB != 412.5 {
		t.Errorf("update 1 parsed wrong: %+v", s.Updates[0])
	}
	if len(s.Failed) != 1 || !strings.Contains(s.Failed[0].Error, "0x80070643") {
		t.Errorf("failed = %+v", s.Failed)
	}
	if s.LastInstalledAt != "2024-06-12T03:00:00Z" {
		t.Errorf("last installed = %q", s.LastInstalledAt)
	}
	if s.Definitions == nil || s.Definitions.Version != "1.413.85.0" || s.Definitions.AgeDays == nil || *s.Definitions.AgeDays != 2 {
		t.Errorf("definitions = %+v", s.Definitions)
	}
	if !s.Complete {
		t.Error("a history warning must not mark the scan incomplete")
	}
}

func TestParseWindowsSearchFailureIsIncomplete(t *testing.T) {
	s := parseWindowsUpdateOutput("E\tsearch: 0x8024402C\n")
	if s.Complete {
		t.Fatal("a failed search must mark the scan incomplete so the server does not treat missing updates as installed")
	}
}

func TestParseAptUpgradable(t *testing.T) {
	out := `Listing...
openssl/jammy-updates,jammy-security 3.0.2-0ubuntu1.15 amd64 [upgradable from: 3.0.2-0ubuntu1.14]
linux-image-5.15.0-113-generic/jammy-updates,jammy-security 5.15.0-113.123 amd64 [upgradable from: 5.15.0-112.122]
nginx/jammy-updates 1.18.0-6ubuntu14.5 amd64 [upgradable from: 1.18.0-6ubuntu14.4]
`
	items := parseAptUpgradable(out)
	if len(items) != 3 {
		t.Fatalf("items = %d", len(items))
	}
	if items[0].Category != catSecurity || items[0].Severity != "high" || items[0].CurrentVersion != "3.0.2-0ubuntu1.14" {
		t.Errorf("openssl = %+v", items[0])
	}
	if items[1].Category != catKernel || !items[1].RequiresReboot {
		t.Errorf("kernel = %+v", items[1])
	}
	if items[2].Category != catPackage {
		t.Errorf("nginx = %+v", items[2])
	}
}

func TestParseDnf(t *testing.T) {
	out := `
kernel.x86_64                     5.14.0-427.24.1.el9_4   baseos
openssl.x86_64                    1:3.0.7-27.el9          baseos
bash.x86_64                       5.1.8-9.el9             baseos

Obsoleting Packages
foo.x86_64   1.0   repo
`
	items := parseDnfCheckUpdate(out)
	if len(items) != 3 {
		t.Fatalf("items = %d (%+v)", len(items), items)
	}
	sec := parseDnfSecurityList(`Last metadata expiration check: 0:10:00 ago
RHSA-2024:4623 Important/Sec.  openssl-1:3.0.7-27.el9.x86_64
RHSA-2024:5101 Critical/Sec.   kernel-5.14.0-427.24.1.el9_4.x86_64
`)
	markSecurity(items, sec)
	got := map[string]UpdateItem{}
	for _, i := range items {
		got[i.Key] = i
	}
	if got["openssl"].Category != catSecurity || got["openssl"].Severity != "high" {
		t.Errorf("openssl = %+v", got["openssl"])
	}
	if got["kernel"].Category != catKernel || got["kernel"].Severity != "critical" {
		t.Errorf("kernel = %+v", got["kernel"])
	}
	if got["bash"].Category != catPackage {
		t.Errorf("bash = %+v", got["bash"])
	}
}

func TestRpmNameFromNVRA(t *testing.T) {
	cases := map[string]string{
		"openssl-1:3.0.7-27.el9.x86_64":                "openssl",
		"kernel-5.14.0-427.24.1.el9_4.x86_64":          "kernel",
		"python3-libs-3.9.18-3.el9_4.1.x86_64":         "python3-libs",
	}
	for in, want := range cases {
		if got := rpmNameFromNVRA(in); got != want {
			t.Errorf("%s -> %s, want %s", in, got, want)
		}
	}
}

func TestParseZypper(t *testing.T) {
	out := `S | Repository | Name           | Current Version | Available Version | Arch
--+------------+----------------+-----------------+-------------------+-------
v | Update     | kernel-default | 5.14.21-1       | 5.14.21-2         | x86_64
v | Update     | curl           | 7.79.1-1        | 7.79.1-2          | x86_64
`
	items := parseZypperList(out)
	if len(items) != 2 || items[0].Category != catKernel || items[1].Key != "curl" || items[1].NewVersion != "7.79.1-2" {
		t.Errorf("items = %+v", items)
	}
	patches := parseZypperSecurityPatches(`Repository | Name          | Category | Severity  | Interactive | Status | Since | Summary
-----------+---------------+----------+-----------+-------------+--------+-------+-----------------------
Update     | SUSE-2024-123 | security | important | ---         | needed | -     | Security update for openssl
`)
	if len(patches) != 1 || patches[0].Severity != "high" || patches[0].Category != catSecurity {
		t.Errorf("patches = %+v", patches)
	}
}

func TestParseFwupd(t *testing.T) {
	out := `{"Devices":[{"Name":"UEFI dbx","DeviceId":"abc123","Version":"217","Releases":[{"Version":"371","Summary":"Update","Urgency":"high"}]},{"Name":"Webcam","DeviceId":"def","Version":"1","Releases":[]}]}`
	items := parseFwupdJSON(out)
	if len(items) != 1 || items[0].Category != catFirmware || items[0].NewVersion != "371" || items[0].Severity != "high" || items[0].Key != "fwupd:abc123" {
		t.Errorf("items = %+v", items)
	}
	if parseFwupdJSON("not json") != nil {
		t.Error("garbage must parse to nothing")
	}
}

func TestParseSoftwareUpdateNewFormat(t *testing.T) {
	out := `Software Update Tool

Finding available software
Software Update found the following new or updated software:
* Label: macOS Sonoma 14.6.1-23G93
	Title: macOS Sonoma 14.6.1, Version: 14.6.1, Size: 1234567KiB, Recommended: YES, Action: restart,
* Label: Safari17.6MontereyAuto17.6
	Title: Safari, Version: 17.6, Size: 153600KiB, Recommended: YES,
* Label: Command Line Tools for Xcode-15.3
	Title: Command Line Tools for Xcode, Version: 15.3, Size: 716800KiB, Recommended: NO,
`
	items := parseSoftwareUpdateList(out)
	if len(items) != 3 {
		t.Fatalf("items = %d (%+v)", len(items), items)
	}
	if items[0].Category != catOS || !items[0].RequiresReboot || items[0].Severity != "high" || items[0].NewVersion != "14.6.1" || items[0].SizeMB != 1205.6 {
		t.Errorf("macOS = %+v", items[0])
	}
	if items[1].Category != catApplication || items[1].Severity != "medium" || items[1].RequiresReboot {
		t.Errorf("Safari = %+v", items[1])
	}
	if items[2].Category != catPackage {
		t.Errorf("CLT = %+v", items[2])
	}
}

func TestParseSoftwareUpdateOldFormat(t *testing.T) {
	out := `Software Update found the following new or updated software:
   * Safari15.6.1MojaveAuto-15.6.1
	Safari (15.6.1), 89184K [recommended]
   * macOS Big Sur Security Update-11.7
	macOS Big Sur Security Update (11.7), 1048576K [recommended] [restart]
`
	items := parseSoftwareUpdateList(out)
	if len(items) != 2 {
		t.Fatalf("items = %d (%+v)", len(items), items)
	}
	if items[0].Category != catApplication || items[1].Category != catSecurity && items[1].Category != catOS {
		t.Errorf("categories = %s / %s", items[0].Category, items[1].Category)
	}
	if !items[1].RequiresReboot || items[1].NewVersion != "11.7" {
		t.Errorf("security update = %+v", items[1])
	}
}

func TestParseSoftwareUpdateNothingPending(t *testing.T) {
	if items := parseSoftwareUpdateList("Software Update Tool\n\nFinding available software\nNo new software available.\n"); len(items) != 0 {
		t.Errorf("items = %+v", items)
	}
}

func TestNormalizeUpdateScanDisruptiveAndSorting(t *testing.T) {
	s := normalizeUpdateScan(UpdateScan{Updates: []UpdateItem{
		{Key: "pkg", Title: "b-pkg", Category: catPackage},
		{Key: "krn", Title: "kernel", Category: catKernel},
		{Key: "sec", Title: "openssl", Category: catSecurity, Severity: "high"},
		{Key: "sec", Title: "duplicate", Category: catSecurity},
		{Key: "app", Title: "app", Category: catApplication, RequiresReboot: true},
		{Key: "crit", Title: "critical pkg", Category: catPackage, Severity: "critical"},
	}})
	if len(s.Updates) != 5 {
		t.Fatalf("updates = %d, duplicates must be dropped", len(s.Updates))
	}
	byKey := map[string]UpdateItem{}
	for _, u := range s.Updates {
		byKey[u.Key] = u
	}
	if !byKey["krn"].IsDisruptive || byKey["pkg"].IsDisruptive || byKey["sec"].IsDisruptive || !byKey["app"].IsDisruptive || !byKey["crit"].IsDisruptive {
		t.Errorf("disruptive flags wrong: %+v", byKey)
	}
	if s.Updates[0].Category != catSecurity && s.Updates[0].Category != catKernel {
		t.Errorf("security/kernel must sort first, got %s", s.Updates[0].Category)
	}
	if s.Failed == nil || s.Warnings == nil {
		t.Error("nil slices would serialise as null")
	}
}
