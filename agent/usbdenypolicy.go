package main

import (
	"fmt"
	"strings"
)

// buildDenyDeviceIDs returns "USB\VID_xxxx&PID_yyyy" strings for the policy entries that mean
// "this whole model": VendorID and ProductID set and nothing else. That is the only thing
// Windows' own DenyDeviceIDs policy can express.
//
// An entry that also carries a serial number or a name pattern is narrower than a model (one
// physical drive, or drives with a certain name). Putting its model on the Windows list would
// silently block every unit of that model, so those entries stay with the
// "disable the connected device" path in ApplyUsbPolicy, which honours every field.
func buildDenyDeviceIDs(entries []UsbPolicyEntry) []string {
	seen := map[string]bool{}
	var ids []string
	for _, e := range entries {
		if e.VendorID == "" || e.ProductID == "" || e.SerialNumber != "" || e.DeviceNamePattern != "" {
			continue
		}
		id := fmt.Sprintf(`USB\VID_%s&PID_%s`, strings.ToUpper(e.VendorID), strings.ToUpper(e.ProductID))
		if !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	return ids
}

// denyPolicyScript returns the PowerShell that makes the Windows Device Installation
// Restriction policy match ids exactly.
//
// The documented layout under
// HKLM\SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions is:
//
//	DenyDeviceIDs            REG_DWORD 1      (switches the list on)
//	DenyDeviceIDsRetroactive REG_DWORD 1      (also applies to devices installed earlier)
//	DenyDeviceIDs\           subkey with string values "1", "2", ... one hardware ID each
//
// Earlier versions wrote the IDs as a single REG_MULTI_SZ value named DenyDeviceIDs. Windows
// ignores that shape, so a listed drive was never refused at plug-in - it was only disabled by
// the periodic check, up to a minute later. The script removes that old value.
//
// It changes nothing when the registry already matches (this runs on every policy cycle), never
// recreates the Restrictions key (that would wipe unrelated values an administrator put there),
// and asks Windows to re-scan hardware when an ID leaves the list, so a drive that was refused
// comes back without a re-plug.
func denyPolicyScript(ids []string) string {
	quoted := make([]string, len(ids))
	for i, id := range ids {
		quoted[i] = "'" + strings.ReplaceAll(id, "'", "''") + "'"
	}
	return `
$path = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions'
$list = Join-Path $path 'DenyDeviceIDs'
$want = @(` + strings.Join(quoted, ",") + `)

$have = @()
if (Test-Path $list) {
  $k = Get-Item $list
  $have = @($k.GetValueNames() | ForEach-Object { [string]$k.GetValue($_) })
}
$flagOn = $false
$oldShape = $false
if (Test-Path $path) {
  $p = Get-Item $path
  if ($p.GetValueNames() -contains 'DenyDeviceIDs') {
    if ($p.GetValueKind('DenyDeviceIDs') -eq 'DWord') { $flagOn = ($p.GetValue('DenyDeviceIDs') -eq 1) } else { $oldShape = $true }
  }
}

$same = (@($have | Sort-Object) -join '|') -eq (@($want | Sort-Object) -join '|')
if ($want.Count -eq 0) {
  if (-not $oldShape -and -not $flagOn -and $have.Count -eq 0) { return }
} elseif ($same -and $flagOn -and -not $oldShape) { return }

if ($want.Count -eq 0) {
  if (Test-Path $path) {
    Remove-ItemProperty -Path $path -Name DenyDeviceIDs -ErrorAction SilentlyContinue
    Remove-ItemProperty -Path $path -Name DenyDeviceIDsRetroactive -ErrorAction SilentlyContinue
  }
  if (Test-Path $list) { Remove-Item -Path $list -Recurse -Force -ErrorAction SilentlyContinue }
} else {
  if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
  Remove-ItemProperty -Path $path -Name DenyDeviceIDs -ErrorAction SilentlyContinue
  New-ItemProperty -Path $path -Name DenyDeviceIDs -Value 1 -PropertyType DWord -Force | Out-Null
  New-ItemProperty -Path $path -Name DenyDeviceIDsRetroactive -Value 1 -PropertyType DWord -Force | Out-Null
  if (Test-Path $list) { Remove-Item -Path $list -Recurse -Force -ErrorAction SilentlyContinue }
  New-Item -Path $list -Force | Out-Null
  $i = 1
  foreach ($id in $want) {
    New-ItemProperty -Path $list -Name ([string]$i) -Value $id -PropertyType String -Force | Out-Null
    $i++
  }
}

$removed = @($have | Where-Object { $want -notcontains $_ })
if ($removed.Count -gt 0) { & pnputil.exe /scan-devices | Out-Null }
`
}
