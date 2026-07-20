package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

// A server with dozens of sites (a real production box in this session had 43) can
// legitimately take well over the shared 10s subprocessTimeout (see hardware.go) to probe
// every binding - confirmed live: the shared helper silently killed the script mid-run,
// producing an empty result every single pass. This collector gets its own, much longer
// budget instead of raising the shared timeout (which every other, genuinely-fast collector
// in this agent relies on staying tight).
const longPowerShellTimeout = 120 * time.Second
const iisPollInterval = 3 * time.Minute

// runPowerShellScript writes the script to a temp .ps1 file and runs it via -File rather than
// passing it inline via -Command - confirmed live, not theoretical: powershell.exe's -Command
// argument parsing silently strips embedded double quotes in some (not all - the simpler
// iisCollectScript was fine) multi-line scripts, turning e.g. ToString("o") into the syntax
// error ToString(o) and dropping a quoted string literal entirely. -File has no such
// ambiguity - the script is read as a real file, not reconstructed from a command-line
// string - and was verified directly against this exact failure case.
func runPowerShellScript(timeout time.Duration, script string) string {
	tmpFile, err := os.CreateTemp("", "logmonitor-*.ps1")
	if err != nil {
		return ""
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.WriteString(script); err != nil {
		tmpFile.Close()
		return ""
	}
	tmpFile.Close()

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	out, err := exec.CommandContext(ctx, "powershell", "-NoProfile", "-File", tmpFile.Name()).Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

const iisAppCmdPath = `C:\Windows\System32\inetsrv\appcmd.exe`

// IisDetected is a fast, dependency-free presence check (no PowerShell spawn) - appcmd.exe
// ships with every IIS install and only that, so this correctly distinguishes "no IIS role"
// from "IIS role installed" on every supported Windows Server version.
func IisDetected() bool {
	if runtime.GOOS != "windows" {
		return false
	}
	_, err := os.Stat(iisAppCmdPath)
	return err == nil
}

type IisAppPoolInfo struct {
	Name  string `json:"Name"`
	State string `json:"State"`
}

type IisWorkerProcessInfo struct {
	ProcessId      int      `json:"ProcessId"`
	AppPoolName    string   `json:"AppPoolName"`
	CpuPercent     *float64 `json:"CpuPercent"`
	PrivateBytesMB *float64 `json:"PrivateBytesMB"`
}

type IisSiteInfo struct {
	Name           string   `json:"Name"`
	State          string   `json:"State"`
	Bindings       string   `json:"Bindings"`
	Protocol       string   `json:"Protocol"`
	Port           int      `json:"Port"`
	HostHeader     string   `json:"HostHeader"`
	StatusCode     *int     `json:"StatusCode"`
	ResponseTimeMs *float64 `json:"ResponseTimeMs"`
	IsAvailable    bool     `json:"IsAvailable"`
	SslExpiresAt   string   `json:"SslExpiresAt"`
}

// IisStatus is the full payload posted to /api/agent/iis-status. Detected is always true when
// this is actually sent (run.go only calls CollectIisStatus behind an IisDetected() gate) -
// kept on the struct anyway so the server-side handler never has to guess why a payload
// might be empty.
type IisStatus struct {
	Detected                 bool                   `json:"detected"`
	AppPools                 []IisAppPoolInfo       `json:"appPools"`
	Sites                    []IisSiteInfo          `json:"sites"`
	WorkerProcesses          []IisWorkerProcessInfo `json:"workerProcesses"`
	WebServiceRequestsPerSec *float64               `json:"webServiceRequestsPerSec"`
	CurrentConnections       *float64               `json:"currentConnections"`
	AspNetRequestsPerSec     *float64               `json:"aspNetRequestsPerSec"`
	FailedRequestTraceCount  int                    `json:"failedRequestTraceCount"`
}

// iisRawResult mirrors iisCollectScript's ConvertTo-Json output shape exactly (PascalCase,
// matching PowerShell's default property serialization) - kept separate from the
// camelCase IisStatus the server expects, rather than fighting json tags in two directions.
type iisRawResult struct {
	AppPools                 []IisAppPoolInfo       `json:"AppPools"`
	Sites                    []IisSiteInfo          `json:"Sites"`
	WorkerProcesses          []IisWorkerProcessInfo `json:"WorkerProcesses"`
	WebServiceRequestsPerSec *float64               `json:"WebServiceRequestsPerSec"`
	CurrentConnections       *float64               `json:"CurrentConnections"`
	AspNetRequestsPerSec     *float64               `json:"AspNetRequestsPerSec"`
	FailedRequestTraceCount  int                    `json:"FailedRequestTraceCount"`
}

// CollectIisStatus is best-effort like every other collector in this agent: any failure
// (PowerShell error, malformed JSON) degrades to an empty-but-Detected-true payload rather
// than blocking the rest of the heartbeat cycle. Every sub-part of the underlying PowerShell
// script (app pools, per-site probes, worker-process stats, perf counters, Failed Request
// Tracing count) is independently try/catch-wrapped there for the same reason - one missing
// permission or disabled feature shouldn't blank out everything else.
func CollectIisStatus() IisStatus {
	out := IisStatus{Detected: true}
	if !IisDetected() {
		out.Detected = false
		return out
	}

	raw := runPowerShellScript(longPowerShellTimeout, iisCollectScript)
	if strings.TrimSpace(raw) == "" {
		return out
	}

	var parsed iisRawResult
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return out
	}

	out.AppPools = parsed.AppPools
	out.Sites = parsed.Sites
	out.WorkerProcesses = parsed.WorkerProcesses
	out.WebServiceRequestsPerSec = parsed.WebServiceRequestsPerSec
	out.CurrentConnections = parsed.CurrentConnections
	out.AspNetRequestsPerSec = parsed.AspNetRequestsPerSec
	out.FailedRequestTraceCount = parsed.FailedRequestTraceCount
	return out
}

// runIisPolling runs entirely on its own ticker, independent of the main heartbeat loop in
// run.go - a real production IIS box in this session took long enough to probe every site
// (43 of them) that running this inline would have delayed heartbeats and every other
// collector on the same tick. Same rationale, same pattern as runUsbPolling. IisDetected() is
// re-checked every tick (it's a cheap os.Stat) rather than once at startup, so a mid-lifetime
// IIS role install/removal is picked up within one interval instead of requiring an agent
// restart - this runs unconditionally on every platform, but is a fast no-op everywhere IIS
// isn't relevant (non-Windows, or Windows without the IIS role).
func runIisPolling(client *Client, stop <-chan struct{}) {
	ticker := time.NewTicker(iisPollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			if IisDetected() {
				if err := client.PostIisStatus(CollectIisStatus()); err != nil {
					log.Printf("IIS status upload failed: %v", err)
				}
			}
		}
	}
}

// iisCollectScript does everything in one PowerShell invocation (minimizing process-spawn
// overhead on a server that could have dozens of sites/app pools): app pool states, a live
// HTTP(S) probe per site (availability/status code/response time), SSL certificate expiry
// read directly from the bound certificate in the local store, per-worker-process (w3wp.exe)
// CPU%/private bytes joined from appcmd + performance counters, aggregate Web
// Service/ASP.NET Applications counters, and a Failed Request Tracing file count. Every
// individual piece was verified against a real, busy production IIS server (45 app pools, 43
// sites, 39 worker processes) before being embedded here - see the comments inline for the
// two real bugs that surfaced doing that (the ServerCertificateValidationCallback runspace
// failure, and Get-Counter's InstanceName not disambiguating multiple w3wp instances).
const iisCollectScript = `
Import-Module WebAdministration -ErrorAction SilentlyContinue

# A plain scriptblock ({$true}) assigned to ServerCertificateValidationCallback throws "There
# is no Runspace available to run scripts in this thread" the moment it actually fires, since
# TLS certificate validation happens on a background I/O thread with no PowerShell runspace -
# confirmed live, not theoretical. A compiled static delegate avoids the runspace problem but
# PowerShell 5.1 fails to implicitly convert the method group to
# RemoteCertificateValidationCallback ("Cannot convert ... PSMethod to
# RemoteCertificateValidationCallback") - also confirmed live. ICertificatePolicy is the
# older (but still fully functional on .NET Framework/Windows PowerShell 5.1) mechanism that
# sidesteps both: assigning a plain object instance to CertificatePolicy needs no delegate
# conversion at all.
if (-not ([System.Management.Automation.PSTypeName]'IisMonTrustAllCerts').Type) {
Add-Type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class IisMonTrustAllCerts : ICertificatePolicy {
    public bool CheckValidationResult(ServicePoint sp, X509Certificate cert, WebRequest req, int problem) { return true; }
}
"@
}
[System.Net.ServicePointManager]::CertificatePolicy = New-Object IisMonTrustAllCerts
try { [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 } catch {}

function Get-CounterSafe($path) {
  try { (Get-Counter -Counter $path -ErrorAction Stop).CounterSamples[0].CookedValue } catch { $null }
}

$appPools = @(Get-ChildItem IIS:\AppPools -ErrorAction SilentlyContinue | ForEach-Object {
  [PSCustomObject]@{ Name = $_.Name; State = $_.State.ToString() }
})

$sites = @()
foreach ($site in (Get-ChildItem IIS:\Sites -ErrorAction SilentlyContinue)) {
  $bindingsCol = @($site.Bindings.Collection)
  $httpsBinding = $bindingsCol | Where-Object { $_.Protocol -eq 'https' } | Select-Object -First 1
  $primary = if ($httpsBinding) { $httpsBinding } else { $bindingsCol | Select-Object -First 1 }

  $protocol = if ($primary) { $primary.Protocol } else { "http" }
  $bindingInfo = if ($primary) { $primary.BindingInformation } else { "" }
  $parts = $bindingInfo -split ':'
  $port = if ($parts.Length -ge 2 -and $parts[1]) { $parts[1] } else { if ($protocol -eq 'https') { 443 } else { 80 } }
  $hostHeader = if ($parts.Length -ge 3 -and $parts[2]) { $parts[2] } else { "" }

  $statusCode = $null
  $responseMs = $null
  $available = $false
  try {
    # For an SNI https binding, TLS routing to the right site/certificate happens on the
    # ClientHello's SNI hostname - connecting to "localhost" would send SNI=localhost, which
    # matches none of these bindings and fails before the Host header (an HTTP-layer concept)
    # is ever considered. Using the real host header as the connection target fixes SNI, cert
    # matching, and the Host header all at once - the same thing a real visitor's browser
    # does. Trade-off: this makes the probe depend on the hostname's own DNS resolution
    # rather than being purely local; a real DNS outage would show as a false "unavailable"
    # here even though IIS itself is fine, which is judged an acceptable/rare trade-off for
    # measuring what visitors actually experience.
    $targetHost = if ($hostHeader) { $hostHeader } else { "localhost" }
    $uri = "${protocol}://${targetHost}:${port}/"
    $headers = @{}
    if ($hostHeader) { $headers['Host'] = $hostHeader }
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    # The per-site timeout is a real tradeoff, not an arbitrary number: a server with dozens
    # of sites (a real production box in this session had 43) multiplies it by "how many
    # sites turn out to be unreachable", but too short a timeout misreports a genuinely slow
    # (not down) cold-started w3wp.exe as unavailable - live data this session showed real
    # cold starts up to ~5s. 5s covers that observed case while still bounding the worst-case
    # total (a handful of truly unreachable sites, not all of them) well inside the overall
    # script's longPowerShellTimeout budget on the Go side.
    $resp = Invoke-WebRequest -Uri $uri -Headers $headers -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    $sw.Stop()
    $statusCode = [int]$resp.StatusCode
    $responseMs = [math]::Round($sw.Elapsed.TotalMilliseconds, 1)
    $available = $true
  } catch {
    $sw.Stop()
    $responseMs = [math]::Round($sw.Elapsed.TotalMilliseconds, 1)
    if ($_.Exception.Response) {
      $statusCode = [int]$_.Exception.Response.StatusCode
      $available = $true
    } else {
      $available = $false
    }
  }

  $sslExpires = $null
  if ($protocol -eq 'https' -and $primary.certificateHash) {
    try {
      $storeName = if ($primary.certificateStoreName) { $primary.certificateStoreName } else { "My" }
      $cert = Get-Item "Cert:\LocalMachine\$storeName\$($primary.certificateHash)" -ErrorAction SilentlyContinue
      if ($cert) { $sslExpires = $cert.NotAfter.ToUniversalTime().ToString("o") }
    } catch {}
  }

  $sites += [PSCustomObject]@{
    Name           = $site.Name
    State          = $site.State.ToString()
    Bindings       = (($bindingsCol | ForEach-Object { $_.Protocol + "/" + $_.BindingInformation }) -join ",")
    Protocol       = $protocol
    Port           = [int]$port
    HostHeader     = $hostHeader
    StatusCode     = $statusCode
    ResponseTimeMs = $responseMs
    IsAvailable    = $available
    SslExpiresAt   = $sslExpires
  }
}

$workerProcesses = @()
try {
  $wpXml = [xml](& "$env:SystemRoot\System32\inetsrv\appcmd.exe" list wp /xml)
  $wpList = @($wpXml.appcmd.WP)
  $procCounters = $null
  try { $procCounters = Get-Counter -Counter '\Process(w3wp*)\% Processor Time','\Process(w3wp*)\ID Process','\Process(w3wp*)\Private Bytes' -ErrorAction Stop } catch {}
  # InstanceName is just "w3wp" for every sample when multiple w3wp processes are running -
  # the "#N" disambiguator that actually distinguishes one process's samples from another's
  # only shows up inside Path (e.g. "\\host\process(w3wp#37)\% processor time"), so that has
  # to be what's grouped on, not InstanceName.
  $byInstance = if ($procCounters) {
    $procCounters.CounterSamples | Group-Object { [regex]::Match($_.Path, '\(([^)]+)\)').Groups[1].Value }
  } else { @() }
  $statsByPid = @{}
  foreach ($grp in $byInstance) {
    $cpuSample = $grp.Group | Where-Object { $_.Path -like '*% processor time*' } | Select-Object -First 1
    $pidSample = $grp.Group | Where-Object { $_.Path -like '*id process*' } | Select-Object -First 1
    $memSample = $grp.Group | Where-Object { $_.Path -like '*private bytes*' } | Select-Object -First 1
    if ($pidSample) {
      $statsByPid[[int]$pidSample.CookedValue] = [PSCustomObject]@{
        CpuPercent     = if ($cpuSample) { [math]::Round($cpuSample.CookedValue, 1) } else { $null }
        PrivateBytesMB = if ($memSample) { [math]::Round($memSample.CookedValue / 1MB, 1) } else { $null }
      }
    }
  }
  foreach ($wp in $wpList) {
    $pidVal = [int]$wp.'WP.NAME'
    $stats = $statsByPid[$pidVal]
    $workerProcesses += [PSCustomObject]@{
      ProcessId      = $pidVal
      AppPoolName    = $wp.'APPPOOL.NAME'
      CpuPercent     = if ($stats) { $stats.CpuPercent } else { $null }
      PrivateBytesMB = if ($stats) { $stats.PrivateBytesMB } else { $null }
    }
  }
} catch {}

$currentConnections = Get-CounterSafe '\Web Service(_Total)\Current Connections'
$webReqPerSec = Get-CounterSafe '\Web Service(_Total)\Total Method Requests/sec'
$aspnetReqPerSec = Get-CounterSafe '\ASP.NET Applications(__Total__)\Requests/Sec'

$frtCount = 0
$frtDir = "$env:SystemDrive\inetpub\logs\FailedReqLogFiles"
if (Test-Path $frtDir) {
  $frtCount = @(Get-ChildItem $frtDir -Recurse -Filter "*.xml" -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -ge (Get-Date).AddMinutes(-10) }).Count
}

$result = [PSCustomObject]@{
  AppPools                 = $appPools
  Sites                    = $sites
  WorkerProcesses          = $workerProcesses
  WebServiceRequestsPerSec = $webReqPerSec
  CurrentConnections       = $currentConnections
  AspNetRequestsPerSec     = $aspnetReqPerSec
  FailedRequestTraceCount  = $frtCount
}
# ConvertTo-Json's well-known "single-element array unwraps to a bare object" quirk applies
# when an array is piped/passed directly as the top-level input - it does NOT affect these
# array-typed properties nested inside $result (confirmed live: AppPools/Sites/WorkerProcesses
# stayed proper JSON arrays across every run this session, including runs with 45+ elements).
ConvertTo-Json -InputObject $result -Depth 5 -Compress
`
