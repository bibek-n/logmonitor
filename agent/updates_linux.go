//go:build linux

package main

import (
	"os/exec"
	"strings"
	"time"
)

const linuxScanTimeout = 6 * time.Minute

func haveCmd(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}

// collectUpdatesPlatform detects the package manager (apt, dnf, yum or zypper) and reads pending updates
// from it. Read-only apart from refreshing the package index, which is what "check for updates" means.
func collectUpdatesPlatform() UpdateScan {
	s := UpdateScan{Supported: true, Complete: true}
	switch {
	case haveCmd("apt-get") && haveCmd("apt"):
		s.Family = "apt"
		runShell(3*time.Minute, "DEBIAN_FRONTEND=noninteractive apt-get update -qq >/dev/null 2>&1")
		out := runShell(linuxScanTimeout, "LC_ALL=C apt list --upgradable 2>/dev/null")
		s.Updates = parseAptUpgradable(out)
		s.RebootRequired = runShell(10*time.Second, "test -f /var/run/reboot-required && echo yes") == "yes"
		if audit := runShell(30*time.Second, "LC_ALL=C dpkg --audit 2>/dev/null | head -n 5"); audit != "" {
			s.Failed = append(s.Failed, FailedUpdate{Key: "dpkg-audit", Title: "Packages left half-installed or unconfigured", Error: firstLine(audit)})
		}
		if last := runShell(10*time.Second, `grep -h " upgrade \| install " /var/log/dpkg.log 2>/dev/null | tail -n 1 | cut -c1-19`); len(last) == 19 {
			s.LastInstalledAt = strings.Replace(last, " ", "T", 1) + "Z"
		}
	case haveCmd("dnf") || haveCmd("yum"):
		mgr := "dnf"
		if !haveCmd("dnf") {
			mgr = "yum"
		}
		s.Family = mgr
		out := runShell(linuxScanTimeout, "LC_ALL=C "+mgr+" -q check-update 2>/dev/null")
		s.Updates = parseDnfCheckUpdate(out)
		sec := runShell(linuxScanTimeout, "LC_ALL=C "+mgr+" -q updateinfo list --security 2>/dev/null")
		markSecurity(s.Updates, parseDnfSecurityList(sec))
		if haveCmd("needs-restarting") {
			s.RebootRequired = runShell(30*time.Second, "needs-restarting -r >/dev/null 2>&1; echo $?") == "1"
		}
	case haveCmd("zypper"):
		s.Family = "zypper"
		s.Updates = parseZypperList(runShell(linuxScanTimeout, "LC_ALL=C zypper -q --non-interactive list-updates 2>/dev/null"))
		s.Updates = append(s.Updates, parseZypperSecurityPatches(runShell(linuxScanTimeout, "LC_ALL=C zypper -q --non-interactive list-patches --category security 2>/dev/null"))...)
		s.RebootRequired = runShell(10*time.Second, "test -f /run/reboot-needed && echo yes") == "yes"
	default:
		s.Supported = false
		s.Complete = false
		s.Warnings = append(s.Warnings, "no supported package manager found (apt, dnf, yum, zypper)")
		return s
	}

	// Firmware (LVFS) where fwupd is installed.
	if haveCmd("fwupdmgr") {
		s.Updates = append(s.Updates, parseFwupdJSON(runShell(90*time.Second, "fwupdmgr get-updates --json --no-authenticate 2>/dev/null"))...)
	}
	return s
}

func firstLine(s string) string {
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		s = s[:i]
	}
	if len(s) > 200 {
		s = s[:200]
	}
	return s
}
