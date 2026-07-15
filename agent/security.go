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

// collectWindowsSecurity deliberately avoids Get-MpComputerStatus / Get-NetFirewallProfile /
// Get-NetFirewallRule / Get-BitLockerVolume / Get-Tpm - all of those require PowerShell 3.0+
// (Windows 8+), so they silently return nothing on Windows 7 (PowerShell 2.0 - confirmed live
// on a real Windows 7 box: none of these cmdlets even exist there, and runOut's blanket
// error-swallowing meant that showed up as an empty Security Posture, not an error). The WMI
// namespaces and COM object used below have been present since Windows Vista and are still
// fully supported on Windows 10/11, so this one code path covers every supported OS version
// without needing to branch on the Windows release.
func collectWindowsSecurity() SecurityStatus {
	var s SecurityStatus

	// SecurityCenter2 is the same WMI namespace Windows Security Center itself reads from -
	// reports whatever AV product (Defender, Kaspersky, etc.) is actually registered, which
	// is more useful here than a Defender-specific check that says nothing when a third-party
	// AV is what's actually protecting the machine.
	avName := runOut("powershell", "-NoProfile", "-Command",
		"(Get-WmiObject -Namespace root\\SecurityCenter2 -Class AntiVirusProduct -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty displayName)")
	if avName != "" {
		s.AntivirusStatus = avName
		if strings.Contains(strings.ToLower(avName), "defender") || strings.Contains(strings.ToLower(avName), "security essentials") {
			s.DefenderStatus = "enabled"
		}
	} else {
		s.AntivirusStatus = "none detected"
	}

	fwOut := runOut("powershell", "-NoProfile", "-Command",
		`$fw = New-Object -ComObject HNetCfg.FwPolicy2; $enabled = $false; foreach ($p in @(1,2,4)) { if ($fw.FirewallEnabled($p)) { $enabled = $true } }; $enabled`)
	switch strings.TrimSpace(fwOut) {
	case "True":
		s.FirewallEnabled = boolPtr(true)
	case "False":
		s.FirewallEnabled = boolPtr(false)
	}
	if ruleCountOut := runOut("powershell", "-NoProfile", "-Command",
		`(New-Object -ComObject HNetCfg.FwPolicy2).Rules.Count`); ruleCountOut != "" {
		if n, err := strconv.Atoi(strings.TrimSpace(ruleCountOut)); err == nil {
			s.FirewallRulesCount = n
		}
	}

	bitlockerOut := runOut("powershell", "-NoProfile", "-Command",
		`$vol = Get-WmiObject -Namespace root\CIMV2\Security\MicrosoftVolumeEncryption -Class Win32_EncryptableVolume -Filter "DriveLetter='$env:SystemDrive'" -ErrorAction SilentlyContinue; if ($vol) { $vol.GetProtectionStatus().ProtectionStatus } else { "" }`)
	switch strings.TrimSpace(bitlockerOut) {
	case "1":
		s.BitLockerStatus = "on"
	case "0":
		s.BitLockerStatus = "off"
	default:
		// Genuinely unavailable on plenty of real machines, not just an unreadable value -
		// BitLocker itself is a Windows Enterprise/Ultimate/Pro feature, absent entirely on
		// Home/base editions, and the WMI provider above only exists where the feature does.
		s.BitLockerStatus = "unknown"
	}

	// UEFI Secure Boot has no legacy-BIOS equivalent - a pre-UEFI machine (most Windows 7
	// era hardware) genuinely doesn't have this concept, so an empty result here is correct,
	// not a compatibility gap to work around.
	secureBootOut := runOut("powershell", "-NoProfile", "-Command", "Confirm-SecureBootUEFI")
	if strings.TrimSpace(secureBootOut) == "True" {
		s.SecureBootEnabled = boolPtr(true)
	} else if strings.TrimSpace(secureBootOut) == "False" {
		s.SecureBootEnabled = boolPtr(false)
	}

	tpmOut := runOut("powershell", "-NoProfile", "-Command",
		`(Get-WmiObject -Namespace root\CIMV2\Security\MicrosoftTpm -Class Win32_Tpm -ErrorAction SilentlyContinue).ManufacturerVersion`)
	// Some TPM chips return ManufacturerVersion null-padded to a fixed field width (seen
	// live: "7.2.2.0" followed by ~25 NUL bytes) - trim those off, not just whitespace.
	s.TpmVersion = strings.TrimRight(strings.TrimSpace(tpmOut), "\x00")

	// Get-WinEvent has existed since PowerShell 2.0, unlike everything above - no
	// compatibility issue here.
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
