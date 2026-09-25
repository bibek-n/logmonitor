//go:build windows

package main

import "time"

// windowsUpdateScript uses the Windows Update Agent COM API (works on Windows 7 / PowerShell 2.0 up to
// Server 2025). It emits the tab-separated line protocol read by parseWindowsUpdateOutput. Kept free of
// PowerShell backtick escapes (this is a Go raw string) - tabs come from [char]9. ConvertTo-Json is not
// used because PowerShell 2.0 does not have it.
const windowsUpdateScript = `
$ErrorActionPreference = 'Stop'
$t = [string][char]9
function Clean($s) { if ($s -eq $null) { return '' }; return ([string]$s) -replace "[\t\r\n]", ' ' }
try {
  $session = New-Object -ComObject Microsoft.Update.Session
  $searcher = $session.CreateUpdateSearcher()
} catch {
  Write-Output ('E' + $t + 'search: cannot start Windows Update Agent - ' + (Clean $_.Exception.Message))
  exit 0
}
try {
  $res = $searcher.Search("IsInstalled=0 and IsHidden=0")
  foreach ($u in $res.Updates) {
    $cats = @(); foreach ($c in $u.Categories) { $cats += $c.Name }
    $kb = ''; foreach ($k in $u.KBArticleIDs) { $kb = $k; break }
    $rb = 0; try { if ($u.InstallationBehavior.RebootBehavior -ne 0) { $rb = 1 } } catch {}
    $size = 0; try { $size = [math]::Round(([double]$u.MaxDownloadSize) / 1MB, 1) } catch {}
    $sev = ''; try { $sev = $u.MsrcSeverity } catch {}
    Write-Output ((@('U', $u.Identity.UpdateID, (Clean $u.Title), (Clean ($cats -join ';')), (Clean $sev), $kb, $size, $rb, $u.Type)) -join $t)
  }
} catch {
  Write-Output ('E' + $t + 'search: ' + (Clean $_.Exception.Message))
}
try {
  $count = $searcher.GetTotalHistoryCount()
  if ($count -gt 0) {
    $hist = $searcher.QueryHistory(0, [Math]::Min($count, 60))
    $seen = @{}
    $lastOk = $null
    foreach ($e in $hist) {
      $title = Clean $e.Title
      if ($title -eq '') { continue }
      if ($e.ResultCode -eq 2 -and $lastOk -eq $null) { $lastOk = $e.Date.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') }
      if ($seen.ContainsKey($title)) { continue }
      $seen[$title] = 1
      if ($e.ResultCode -eq 4 -or $e.ResultCode -eq 5) {
        $hr = ''; try { $hr = ('0x{0:X8}' -f $e.HResult) } catch {}
        Write-Output ((@('F', $title, $e.ResultCode, $hr, $e.Date.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))) -join $t)
      }
    }
    if ($lastOk) { Write-Output ('L' + $t + $lastOk) }
  }
} catch {
  Write-Output ('E' + $t + 'history: ' + (Clean $_.Exception.Message))
}
try {
  $mp = Get-WmiObject -Namespace 'root\Microsoft\Windows\Defender' -Class MSFT_MpComputerStatus -ErrorAction Stop
  if ($mp) {
    $age = ''
    try { $age = [int]((Get-Date) - $mp.AntivirusSignatureLastUpdated).TotalDays } catch {}
    Write-Output ((@('D', $mp.AntivirusSignatureVersion, $age)) -join $t)
  }
} catch {}
`

func collectUpdatesPlatform() UpdateScan {
	out := runPowerShellScript(10*time.Minute, windowsUpdateScript)
	s := parseWindowsUpdateOutput(out)
	if out == "" {
		s.Complete = false
		s.Warnings = append(s.Warnings, "search: Windows Update scan returned no output (timed out or PowerShell failed)")
	}
	s.RebootRequired = rebootPending()
	return s
}
