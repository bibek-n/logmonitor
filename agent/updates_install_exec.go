package main

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

const installCommandTimeout = 45 * time.Minute

// installPlatform runs the fixed native commands for the approved updates. It never restarts the machine.
func installPlatform(family string, items []UpdateItem) (results []InstallItemResult, reboot bool, output string) {
	switch runtime.GOOS {
	case "windows":
		return installWindows(items)
	case "linux":
		cmds, rejected := buildLinuxInstallCommands(family, items)
		res, out := runInstallCommands(cmds, items)
		reboot = linuxRebootRequired()
		return append(rejected, res...), reboot, out
	case "darwin":
		cmds, rejected := buildMacInstallCommands(items)
		res, out := runInstallCommands(cmds, items)
		// softwareupdate prints when a restart is needed; report it, never perform it.
		return append(rejected, res...), strings.Contains(strings.ToLower(out), "restart"), out
	default:
		for _, it := range items {
			results = append(results, InstallItemResult{Key: it.Key, Title: it.Title, Outcome: outcomeRefused, Message: "installing updates is not supported on this operating system"})
		}
		return results, false, ""
	}
}

func linuxRebootRequired() bool {
	if _, err := os.Stat("/var/run/reboot-required"); err == nil {
		return true
	}
	if _, err := os.Stat("/run/reboot-needed"); err == nil {
		return true
	}
	if haveExec("needs-restarting") {
		return exec.Command("needs-restarting", "-r").Run() != nil
	}
	return false
}

func haveExec(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}

// runInstallCommands runs each command on its own (own outcome per update), capturing combined output.
func runInstallCommands(cmds []installCommand, items []UpdateItem) ([]InstallItemResult, string) {
	titles := map[string]string{}
	for _, it := range items {
		titles[it.Key] = it.Title
	}
	var results []InstallItemResult
	var all bytes.Buffer
	for _, c := range cmds {
		ctx, cancel := context.WithTimeout(context.Background(), installCommandTimeout)
		cmd := exec.CommandContext(ctx, c.Name, c.Args...)
		cmd.Env = append(os.Environ(), c.Env...)
		out, err := cmd.CombinedOutput()
		cancel()
		fmt.Fprintf(&all, "$ %s %s\n%s\n", c.Name, strings.Join(c.Args, " "), tail(string(out), 1500))
		r := InstallItemResult{Key: c.Key, Title: titles[c.Key]}
		if err != nil {
			r.Outcome, r.Message = outcomeFailed, tail(strings.TrimSpace(string(out)), 300)
			if r.Message == "" {
				r.Message = err.Error()
			}
		} else {
			r.Outcome, r.Message = outcomeInstalled, "command succeeded (verified by the next scan)"
		}
		results = append(results, r)
	}
	return results, all.String()
}

// windowsInstallScript uses the Windows Update Agent: accept EULA -> download -> install the chosen updates only, and report
// a per-update result. No reboot is ever triggered. (Go raw string: no PowerShell backticks; tabs come from [char]9.)
const windowsInstallScriptHead = `
$ErrorActionPreference = 'Stop'
$t = [string][char]9
function Clean($s) { if ($s -eq $null) { return '' }; return ([string]$s) -replace "[\t\r\n]", ' ' }
$ids = @(
`

const windowsInstallScriptBody = `
)
try {
  $session = New-Object -ComObject Microsoft.Update.Session
  $searcher = $session.CreateUpdateSearcher()
  $res = $searcher.Search("IsInstalled=0 and IsHidden=0")
  $coll = New-Object -ComObject Microsoft.Update.UpdateColl
  foreach ($u in $res.Updates) {
    if ($ids -contains $u.Identity.UpdateID) {
      try { if (-not $u.EulaAccepted) { $u.AcceptEula() } } catch {}
      [void]$coll.Add($u)
    }
  }
  if ($coll.Count -eq 0) { Write-Output ('E' + $t + 'none of the selected updates are pending any more'); exit 0 }

  $downloader = $session.CreateUpdateDownloader()
  $downloader.Updates = $coll
  [void]$downloader.Download()

  $ready = New-Object -ComObject Microsoft.Update.UpdateColl
  foreach ($u in $coll) {
    if ($u.IsDownloaded) { [void]$ready.Add($u) } else { Write-Output ((@('D', $u.Identity.UpdateID, 'download failed')) -join $t) }
  }
  if ($ready.Count -eq 0) { exit 0 }

  $installer = $session.CreateUpdateInstaller()
  $installer.Updates = $ready
  $installer.AllowSourcePrompts = $false
  try { $installer.ForceQuiet = $true } catch {}
  $result = $installer.Install()
  for ($i = 0; $i -lt $ready.Count; $i++) {
    $r = $result.GetUpdateResult($i)
    $hr = ''; try { $hr = ('0x{0:X8}' -f $r.HResult) } catch {}
    Write-Output ((@('R', $ready.Item($i).Identity.UpdateID, $r.ResultCode, $hr, (Clean $ready.Item($i).Title))) -join $t)
  }
  Write-Output ('B' + $t + $result.RebootRequired)
} catch {
  Write-Output ('E' + $t + (Clean $_.Exception.Message))
}
`

func installWindows(items []UpdateItem) ([]InstallItemResult, bool, string) {
	var quoted []string
	var results []InstallItemResult
	var runnable []UpdateItem
	for _, it := range items {
		if !validGUID(it.Key) {
			results = append(results, InstallItemResult{Key: it.Key, Title: it.Title, Outcome: outcomeRefused, Message: "invalid update id"})
			continue
		}
		quoted = append(quoted, "'"+it.Key+"'")
		runnable = append(runnable, it)
	}
	if len(runnable) == 0 {
		return results, false, ""
	}
	script := windowsInstallScriptHead + strings.Join(quoted, ",\n") + windowsInstallScriptBody
	out := runPowerShellScript(2*time.Hour, script)
	parsed, reboot, _ := parseWindowsInstallOutput(out, runnable)
	return append(results, parsed...), reboot, out
}
