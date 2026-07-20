package main

import (
	"runtime"
	"strconv"
	"strings"
)

// CollectWindowsUpdateStatus is best-effort, matching the rest of this agent: an
// unreadable/unsupported check degrades to the zero value rather than erroring. Uses
// Get-HotFix (present since PowerShell 2.0/Windows 7, backed by the Win32_QuickFixEngineering
// WMI class) rather than the Windows Update Agent COM API, which needs network access to a
// WSUS/Microsoft Update endpoint just to enumerate *installed* patches - Get-HotFix reads
// local state only, so it works identically whether this server has internet access or not.
func CollectWindowsUpdateStatus() WindowsUpdateStatus {
	var s WindowsUpdateStatus
	if runtime.GOOS != "windows" {
		return s
	}

	lastInstalled := runOut("powershell", "-NoProfile", "-Command",
		`(Get-HotFix -ErrorAction SilentlyContinue | Sort-Object InstalledOn -Descending | Select-Object -First 1 -ExpandProperty InstalledOn).ToString("o")`)
	s.LastInstalledAt = strings.TrimSpace(lastInstalled)

	countOut := runOut("powershell", "-NoProfile", "-Command",
		`(Get-HotFix -ErrorAction SilentlyContinue | Where-Object { $_.InstalledOn -ge (Get-Date).AddDays(-30) } | Measure-Object).Count`)
	if n, err := strconv.Atoi(strings.TrimSpace(countOut)); err == nil {
		s.RecentHotfixCount = n
	}

	s.RebootPending = rebootPending()
	return s
}

// rebootPending checks the three registry locations Windows itself uses to track a
// pending-reboot state (Component Based Servicing, Windows Update, and a scheduled file
// rename operation - any one of these being present means a reboot is outstanding) rather
// than inferring it indirectly, so this matches what Server Manager/sconfig would report.
func rebootPending() bool {
	out := runOut("powershell", "-NoProfile", "-Command", `
$paths = @(
  "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending",
  "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired"
)
$pending = $false
foreach ($p in $paths) { if (Test-Path $p) { $pending = $true } }
if (-not $pending) {
  $renameOps = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager" -Name PendingFileRenameOperations -ErrorAction SilentlyContinue)
  if ($renameOps) { $pending = $true }
}
$pending
`)
	return strings.TrimSpace(out) == "True"
}
