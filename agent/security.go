package main

import (
	"os/exec"
	"runtime"
	"strconv"
	"strings"
)

// SecurityStatus is entirely best-effort — every check degrades to "unknown" rather
// than erroring when the relevant tool/service isn't present (e.g. no ufw on a minimal
// Linux server, or Defender disabled in favor of third-party AV on Windows).
type SecurityStatus struct {
	AntivirusStatus     string `json:"antivirusStatus"`
	DefenderStatus      string `json:"defenderStatus"`
	FirewallEnabled     *bool  `json:"firewallEnabled"`
	FirewallRulesCount  int    `json:"firewallRulesCount"`
	BitLockerStatus     string `json:"bitLockerStatus"`
	LuksStatus          string `json:"luksStatus"`
	SecureBootEnabled   *bool  `json:"secureBootEnabled"`
	TpmVersion          string `json:"tpmVersion"`
	SELinuxStatus       string `json:"selinuxStatus"`
	AppArmorStatus      string `json:"apparmorStatus"`
	FailedLoginCount24h int    `json:"failedLoginCount24h"`
}

func boolPtr(b bool) *bool { return &b }

func CollectSecurityStatus() SecurityStatus {
	if runtime.GOOS == "windows" {
		return collectWindowsSecurity()
	}
	return collectLinuxSecurity()
}

func collectWindowsSecurity() SecurityStatus {
	var s SecurityStatus

	defenderOut := runOut("powershell", "-NoProfile", "-Command",
		"(Get-MpComputerStatus | Select-Object -ExpandProperty AMServiceEnabled)")
	if defenderOut == "True" {
		s.DefenderStatus = "enabled"
		s.AntivirusStatus = "enabled"
	} else if defenderOut == "False" {
		s.DefenderStatus = "disabled"
		s.AntivirusStatus = "disabled"
	}

	fwOut := runOut("powershell", "-NoProfile", "-Command",
		"(Get-NetFirewallProfile | Where-Object {$_.Enabled -eq $true} | Measure-Object).Count")
	if n, err := strconv.Atoi(strings.TrimSpace(fwOut)); err == nil {
		s.FirewallEnabled = boolPtr(n > 0)
	}
	if ruleCountOut := runOut("powershell", "-NoProfile", "-Command", "(Get-NetFirewallRule | Measure-Object).Count"); ruleCountOut != "" {
		if n, err := strconv.Atoi(strings.TrimSpace(ruleCountOut)); err == nil {
			s.FirewallRulesCount = n
		}
	}

	bitlockerOut := runOut("powershell", "-NoProfile", "-Command",
		"(Get-BitLockerVolume -MountPoint $env:SystemDrive | Select-Object -ExpandProperty ProtectionStatus)")
	switch strings.TrimSpace(bitlockerOut) {
	case "1":
		s.BitLockerStatus = "on"
	case "0":
		s.BitLockerStatus = "off"
	default:
		s.BitLockerStatus = "unknown"
	}

	secureBootOut := runOut("powershell", "-NoProfile", "-Command", "Confirm-SecureBootUEFI")
	if strings.TrimSpace(secureBootOut) == "True" {
		s.SecureBootEnabled = boolPtr(true)
	} else if strings.TrimSpace(secureBootOut) == "False" {
		s.SecureBootEnabled = boolPtr(false)
	}

	tpmOut := runOut("powershell", "-NoProfile", "-Command",
		"(Get-Tpm | Select-Object -ExpandProperty ManufacturerVersion)")
	s.TpmVersion = strings.TrimSpace(tpmOut)

	failedLoginsOut := runOut("powershell", "-NoProfile", "-Command",
		"(Get-WinEvent -FilterHashtable @{LogName='Security';Id=4625;StartTime=(Get-Date).AddHours(-24)} -ErrorAction SilentlyContinue | Measure-Object).Count")
	if n, err := strconv.Atoi(strings.TrimSpace(failedLoginsOut)); err == nil {
		s.FailedLoginCount24h = n
	}

	return s
}

func collectLinuxSecurity() SecurityStatus {
	var s SecurityStatus

	if out := runOut("ufw", "status"); out != "" {
		s.FirewallEnabled = boolPtr(strings.Contains(strings.ToLower(out), "active"))
	} else if out := runOut("firewall-cmd", "--state"); out != "" {
		s.FirewallEnabled = boolPtr(strings.TrimSpace(out) == "running")
	}

	// grep exits non-zero (and thus runOut returns "") both when lsblk is unavailable
	// and when no LUKS volume is found — can't cleanly distinguish "off" from
	// "undetectable" this way, so only the positive case is reported.
	if devs := runOut("sh", "-c", "lsblk -o NAME,FSTYPE 2>/dev/null | grep -i crypto_luks"); devs != "" {
		s.LuksStatus = "on"
	}

	if out := runOut("getenforce"); out != "" {
		s.SELinuxStatus = strings.ToLower(strings.TrimSpace(out))
	}

	if out := runOut("aa-status", "--enabled"); out != "" {
		s.AppArmorStatus = "enabled"
	} else {
		s.AppArmorStatus = "disabled"
	}

	// Ubuntu/Debian ClamAV, if present, is the most common Linux desktop/server AV.
	if _, err := exec.LookPath("clamscan"); err == nil {
		s.AntivirusStatus = "clamav-installed"
	}

	if out := runOut("sh", "-c", "journalctl -u ssh --since '-24 hours' 2>/dev/null | grep -c 'Failed password'"); out != "" {
		if n, err := strconv.Atoi(strings.TrimSpace(out)); err == nil {
			s.FailedLoginCount24h = n
		}
	}

	return s
}
