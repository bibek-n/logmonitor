package main

import (
	"path/filepath"
	"strings"
	"testing"
)

func pending() []UpdateItem {
	return normalizeUpdateScan(UpdateScan{Updates: []UpdateItem{
		{Key: "curl", Title: "curl", Category: catPackage},
		{Key: "openssl", Title: "openssl", Category: catSecurity, Severity: "high"},
		{Key: "linux-image-5.15.0-113-generic", Title: "kernel", Category: catKernel, RequiresReboot: true},
		{Key: "fwupd:abc", Title: "UEFI dbx", Category: catFirmware},
		{Key: "crit", Title: "critical thing", Category: catPackage, Severity: "critical"},
	}}).Updates
}

func TestPlanInstallRefusesDisruptiveWithoutConfirmation(t *testing.T) {
	ok, res := planInstall(pending(), []string{"curl", "openssl", "linux-image-5.15.0-113-generic", "fwupd:abc", "crit"}, false)
	if len(ok) != 2 || ok[0].Key != "curl" || ok[1].Key != "openssl" {
		t.Fatalf("installable = %+v", ok)
	}
	refused := map[string]bool{}
	for _, r := range res {
		if r.Outcome != outcomeRefused {
			t.Errorf("%s outcome = %s, want refused", r.Key, r.Outcome)
		}
		refused[r.Key] = true
	}
	for _, k := range []string{"linux-image-5.15.0-113-generic", "fwupd:abc", "crit"} {
		if !refused[k] {
			t.Errorf("%s must be refused without administrator confirmation", k)
		}
	}
}

func TestPlanInstallAllowsDisruptiveOnlyWhenConfirmed(t *testing.T) {
	ok, res := planInstall(pending(), []string{"linux-image-5.15.0-113-generic", "fwupd:abc"}, true)
	if len(ok) != 2 || len(res) != 0 {
		t.Fatalf("ok=%d res=%d, want 2/0", len(ok), len(res))
	}
}

func TestPlanInstallTrustsTheDeviceNotTheRequest(t *testing.T) {
	// The request can't declare something non-disruptive: the flags come from the fresh scan on this machine.
	_, res := planInstall(pending(), []string{"crit"}, false)
	if len(res) != 1 || res[0].Outcome != outcomeRefused {
		t.Fatalf("res = %+v", res)
	}
}

func TestPlanInstallUnknownDuplicateAndCap(t *testing.T) {
	ok, res := planInstall(pending(), []string{"curl", "curl", " curl ", "ghost", ""}, false)
	if len(ok) != 1 {
		t.Fatalf("duplicates must collapse, ok = %+v", ok)
	}
	if len(res) != 1 || res[0].Key != "ghost" || res[0].Outcome != outcomeSkipped {
		t.Fatalf("res = %+v", res)
	}
	many := make([]string, 500)
	for i := range many {
		many[i] = "k" + strings.Repeat("x", i%7) + string(rune('a'+i%26)) + string(rune('a'+(i/26)%26)) + string(rune('a'+(i/676)%26))
	}
	_, res = planInstall(nil, many, false)
	if len(res) > maxInstallKeys {
		t.Fatalf("more than %d keys accepted: %d", maxInstallKeys, len(res))
	}
}

func TestLinuxCommandsUseArgumentsNotAShell(t *testing.T) {
	items := []UpdateItem{{Key: "curl", Title: "curl"}, {Key: "openssl", Title: "openssl"}}
	cmds, rej := buildLinuxInstallCommands("apt", items)
	if len(rej) != 0 || len(cmds) != 2 {
		t.Fatalf("cmds=%d rej=%d", len(cmds), len(rej))
	}
	c := cmds[0]
	if c.Name != "apt-get" || c.Args[len(c.Args)-1] != "curl" || !contains(c.Args, "--only-upgrade") || !contains(c.Args, "-y") {
		t.Errorf("apt command = %+v", c)
	}
	if !contains(c.Env, "DEBIAN_FRONTEND=noninteractive") {
		t.Error("apt must run non-interactive")
	}
	for _, fam := range []struct{ f, name, sub string }{{"dnf", "dnf", "upgrade"}, {"yum", "yum", "update"}, {"zypper", "zypper", "update"}} {
		cs, _ := buildLinuxInstallCommands(fam.f, items[:1])
		if len(cs) != 1 || cs[0].Name != fam.name || !contains(cs[0].Args, fam.sub) || cs[0].Args[len(cs[0].Args)-1] != "curl" {
			t.Errorf("%s command = %+v", fam.f, cs)
		}
	}
}

func TestLinuxCommandsRejectInjection(t *testing.T) {
	bad := []string{"curl; rm -rf /", "$(reboot)", "a b", "-o=evil", "curl\nreboot", "`id`", "pkg&&x", "../../etc/passwd", "", "fwupd:a b", "patch:x;y"}
	var items []UpdateItem
	for _, b := range bad {
		items = append(items, UpdateItem{Key: b, Title: b})
	}
	cmds, rej := buildLinuxInstallCommands("apt", items)
	if len(cmds) != 0 {
		t.Fatalf("hostile keys produced commands: %+v", cmds)
	}
	if len(rej) != len(bad) {
		t.Errorf("rejected %d of %d", len(rej), len(bad))
	}
}

func TestFirmwareAndPatchCommands(t *testing.T) {
	cmds, _ := buildLinuxInstallCommands("apt", []UpdateItem{{Key: "fwupd:0123abcd", Title: "fw"}})
	if len(cmds) != 1 || cmds[0].Name != "fwupdmgr" || !contains(cmds[0].Args, "--no-reboot-check") || cmds[0].Args[1] != "0123abcd" {
		t.Errorf("fwupd = %+v", cmds)
	}
	cmds, _ = buildLinuxInstallCommands("zypper", []UpdateItem{{Key: "patch:SUSE-2024-123", Title: "p"}})
	if len(cmds) != 1 || !contains(cmds[0].Args, "patch") || cmds[0].Args[len(cmds[0].Args)-1] != "SUSE-2024-123" {
		t.Errorf("zypper patch = %+v", cmds)
	}
	if cmds, _ = buildLinuxInstallCommands("apt", []UpdateItem{{Key: "patch:SUSE-2024-123"}}); len(cmds) != 0 {
		t.Error("patch keys only make sense on zypper")
	}
}

func TestMacCommandsNeverRestart(t *testing.T) {
	cmds, rej := buildMacInstallCommands([]UpdateItem{{Key: "Safari17.6MontereyAuto17.6"}, {Key: "Command Line Tools for Xcode-15.3"}, {Key: "-R"}, {Key: "x; reboot"}, {Key: "a\nb"}})
	if len(cmds) != 2 || len(rej) != 3 {
		t.Fatalf("cmds=%d rej=%d", len(cmds), len(rej))
	}
	for _, c := range cmds {
		if c.Name != "softwareupdate" || c.Args[0] != "-i" || contains(c.Args, "-R") || contains(c.Args, "--restart") {
			t.Errorf("bad mac command %+v", c)
		}
	}
}

func TestWindowsIDsMustBeGUIDs(t *testing.T) {
	if !validGUID("8f9b8a1e-1c7d-4d1e-9c3a-2b6f5f6a7b8c") {
		t.Error("real GUID rejected")
	}
	for _, s := range []string{"", "1'; Remove-Item C:\\ -Recurse; '", "not-a-guid", "8f9b8a1e-1c7d-4d1e-9c3a-2b6f5f6a7b8c'", "8f9b8a1e1c7d4d1e9c3a2b6f5f6a7b8c"} {
		if validGUID(s) {
			t.Errorf("%q accepted as a GUID", s)
		}
	}
	res, reboot, out := installWindows([]UpdateItem{{Key: "x'; calc; '", Title: "evil"}})
	if len(res) != 1 || res[0].Outcome != outcomeRefused || reboot || out != "" {
		t.Errorf("hostile id must be refused without running PowerShell: %+v", res)
	}
}

func TestParseWindowsInstallOutput(t *testing.T) {
	items := []UpdateItem{{Key: "g1", Title: "Update 1"}, {Key: "g2", Title: "Update 2"}, {Key: "g3", Title: "Update 3"}, {Key: "g4", Title: "Update 4"}}
	out := "R\tg1\t2\t0x00000000\tUpdate 1\nR\tg2\t4\t0x80070643\tUpdate 2\nD\tg3\tdownload failed\nB\tTrue\n"
	res, reboot, _ := parseWindowsInstallOutput(out, items)
	want := []string{outcomeInstalled, outcomeFailed, outcomeFailed, outcomeFailed}
	for i, r := range res {
		if r.Outcome != want[i] {
			t.Errorf("%s = %s, want %s (%s)", r.Key, r.Outcome, want[i], r.Message)
		}
	}
	if !reboot {
		t.Error("restart-required flag lost")
	}
	if !strings.Contains(res[1].Message, "0x80070643") || res[3].Message != "no result reported" {
		t.Errorf("messages: %q / %q", res[1].Message, res[3].Message)
	}
	res, _, fatal := parseWindowsInstallOutput("E\tnone of the selected updates are pending any more\n", items[:1])
	if fatal == "" || res[0].Outcome != outcomeFailed {
		t.Errorf("fatal handling: %+v %q", res, fatal)
	}
}

func TestSummarizeStatus(t *testing.T) {
	cases := []struct {
		res  []InstallItemResult
		ran  bool
		want string
	}{
		{[]InstallItemResult{{Outcome: outcomeInstalled}}, true, "done"},
		{[]InstallItemResult{{Outcome: outcomeInstalled}, {Outcome: outcomeSkipped}}, true, "done"},
		{[]InstallItemResult{{Outcome: outcomeInstalled}, {Outcome: outcomeFailed}}, true, "partial"},
		{[]InstallItemResult{{Outcome: outcomeFailed}}, true, "failed"},
		{[]InstallItemResult{{Outcome: outcomeRefused}}, false, "refused"},
		{[]InstallItemResult{{Outcome: outcomeInstalled}, {Outcome: outcomeRefused}}, true, "partial"},
	}
	for i, c := range cases {
		if got := summarizeStatus(c.res, c.ran); got != c.want {
			t.Errorf("case %d = %s, want %s", i, got, c.want)
		}
	}
}

func TestInflightMarkerRoundTrip(t *testing.T) {
	dir := t.TempDir()
	old := inflightPath
	inflightPath = func() string { return filepath.Join(dir, "sub", "inflight.json") }
	defer func() { inflightPath = old }()

	if readInflight() != nil {
		t.Fatal("no marker expected at start")
	}
	writeInflight(42)
	m := readInflight()
	if m == nil || m.RequestID != 42 || m.StartedAt == "" {
		t.Fatalf("marker = %+v", m)
	}
	clearInflight()
	if readInflight() != nil {
		t.Fatal("marker not cleared")
	}
}

func contains(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}
