//go:build windows

package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const wacStateFile = "wac-blocked-domains.json"

// wacState is this agent's local record of what it has itself applied for Website Access
// Control enforcement (agent/run.go's `go ApplyWacBlocklist(client, hb.WacBlockedDomains)`),
// so a later reconciliation only ever reverses a hosts-file entry or DoH policy value THIS
// mechanism added - never something already there for some other reason (an admin's own hosts
// entry, a real Chrome/Edge GPO, etc). Persisted to
// %ProgramData%\LogMonitorAgent\wac-blocked-domains.json, mirroring usbpolicy_windows.go's
// usb-blocked-devices.json.
type wacState struct {
	Domains          []string `json:"domains"`
	ChromeDohSetByUs bool     `json:"chromeDohSetByUs"`
	EdgeDohSetByUs   bool     `json:"edgeDohSetByUs"`
}

func wacStatePath() string {
	dir := os.Getenv("ProgramData")
	if dir == "" {
		dir = `C:\ProgramData`
	}
	dir = filepath.Join(dir, "LogMonitorAgent")
	_ = os.MkdirAll(dir, 0o755)
	return filepath.Join(dir, wacStateFile)
}

func loadWacState() wacState {
	data, err := os.ReadFile(wacStatePath())
	if err != nil {
		return wacState{}
	}
	var st wacState
	if err := json.Unmarshal(data, &st); err != nil {
		return wacState{}
	}
	return st
}

func saveWacState(st wacState) {
	data, err := json.Marshal(st)
	if err != nil {
		return
	}
	_ = os.WriteFile(wacStatePath(), data, 0o644)
}

// wacStatusMu guards the two package-level fields below, which client.go's Heartbeat() reads
// (via WacStatus) on every heartbeat POST so the request body can report back what the most
// recent ApplyWacBlocklist run actually did - see the aggregated-errors handling at the bottom
// of ApplyWacBlocklist.
var (
	wacStatusMu      sync.Mutex
	wacLastApplied   []string
	wacLastErrorText string
)

// WacStatus returns the domains actually applied by the most recent ApplyWacBlocklist run and
// any error summary from that run, for the heartbeat POST body's wacAppliedDomains/wacError
// fields. Safe to call concurrently with ApplyWacBlocklist (which runs in its own goroutine -
// see run.go).
func WacStatus() ([]string, string) {
	wacStatusMu.Lock()
	defer wacStatusMu.Unlock()
	out := make([]string, len(wacLastApplied))
	copy(out, wacLastApplied)
	return out, wacLastErrorText
}

func setWacStatus(applied []string, errText string) {
	wacStatusMu.Lock()
	defer wacStatusMu.Unlock()
	wacLastApplied = applied
	wacLastErrorText = errText
}

const (
	wacHostsBeginMarker = "# BEGIN LOGMONITOR-WAC-BLOCK"
	wacHostsEndMarker   = "# END LOGMONITOR-WAC-BLOCK"
)

// hostsFilePath resolves via %SystemRoot% rather than hardcoding C:\Windows, so this still
// works correctly on the (rare) non-standard install that puts Windows on a different drive
// or path.
func hostsFilePath() string {
	root := os.Getenv("SystemRoot")
	if root == "" {
		root = `C:\Windows`
	}
	return filepath.Join(root, "System32", "drivers", "etc", "hosts")
}

// stripManagedBlock removes everything from the begin marker line through the end marker line
// (inclusive), leaving every other line - including any content an admin or another tool
// placed in this file - completely untouched.
func stripManagedBlock(content string) string {
	beginIdx := strings.Index(content, wacHostsBeginMarker)
	if beginIdx == -1 {
		return content
	}
	endIdx := strings.Index(content, wacHostsEndMarker)
	if endIdx == -1 {
		// Malformed/truncated previous block (shouldn't happen given atomicWriteFile below,
		// but defensively handled) - drop from the begin marker to end of file rather than
		// leave a dangling fragment behind.
		return content[:beginIdx]
	}
	endIdx += len(wacHostsEndMarker)
	for endIdx < len(content) && (content[endIdx] == '\r' || content[endIdx] == '\n') {
		endIdx++
	}
	return content[:beginIdx] + content[endIdx:]
}

// atomicWriteFile writes to a temp file in the same directory as path, then renames over the
// original, so a crash mid-write can never leave the target file half-written/corrupted.
func atomicWriteFile(path string, data []byte) error {
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, "logmonitor-wac-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		os.Remove(tmpName)
		return err
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmpName)
		return err
	}
	if err := os.Rename(tmpName, path); err != nil {
		os.Remove(tmpName)
		return err
	}
	return nil
}

// applyHostsBlock rewrites the managed block in the Windows hosts file to contain exactly the
// given domains (0.0.0.0 for the bare domain plus its www. variant, unless the domain already
// starts with www.), or removes the block entirely when domains is empty. Never touches
// anything outside the markers.
//
// KNOWN LIMITATION (disclosed, not a bug): this can only block the exact hostnames listed here
// - it cannot do true wildcard-subdomain suffix matching the way the rules engine's
// MatchType:"suffix" conceptually implies for a real firewall. A blocked "example.com" stops
// "example.com" and "www.example.com", but NOT "m.example.com" or any other subdomain that
// wasn't separately enumerated.
func applyHostsBlock(domains []string) error {
	path := hostsFilePath()
	existing, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("read hosts file: %w", err)
	}

	kept := stripManagedBlock(string(existing))

	var newContent string
	if len(domains) == 0 {
		newContent = kept
	} else {
		var b strings.Builder
		b.WriteString(kept)
		if kept != "" && !strings.HasSuffix(kept, "\n") {
			b.WriteString("\r\n")
		}
		b.WriteString(wacHostsBeginMarker + "\r\n")
		for _, d := range domains {
			b.WriteString(fmt.Sprintf("0.0.0.0 %s\r\n", d))
			if !strings.HasPrefix(d, "www.") {
				b.WriteString(fmt.Sprintf("0.0.0.0 www.%s\r\n", d))
			}
		}
		b.WriteString(wacHostsEndMarker + "\r\n")
		newContent = b.String()
	}

	return atomicWriteFile(path, []byte(newContent))
}

func flushDnsCache() {
	// Clear-DnsClientCache is the PowerShell-native equivalent of `ipconfig /flushdns`, kept
	// consistent with this agent's existing convention (iis.go, usbpolicy_windows.go) of doing
	// system-level work through runPowerShellScript rather than shelling out to separate native
	// exes.
	runPowerShellScript(15*time.Second, "Clear-DnsClientCache")
}

// regValueExists reports whether the given registry value name currently exists under path, via
// PowerShell - matching this file's (and usbpolicy_windows.go's) existing convention of never
// using the native golang.org/x/sys/windows/registry package for machine-wide policy keys.
func regValueExists(path, name string) bool {
	script := fmt.Sprintf(`
if (Test-Path '%s') {
  $v = Get-ItemProperty -Path '%s' -Name '%s' -ErrorAction SilentlyContinue
  if ($null -ne $v) { Write-Output 'yes' } else { Write-Output 'no' }
} else {
  Write-Output 'no'
}
`, path, path, name)
	return runPowerShellScript(15*time.Second, script) == "yes"
}

func setChromiumDohOff(path string) {
	script := fmt.Sprintf(`
New-Item -Path '%s' -Force | Out-Null
Set-ItemProperty -Path '%s' -Name DnsOverHttpsMode -Value 'off' -Type String
`, path, path)
	runPowerShellScript(15*time.Second, script)
}

func removeChromiumDohSetting(path string) {
	script := fmt.Sprintf(`
if (Test-Path '%s') {
  Remove-ItemProperty -Path '%s' -Name DnsOverHttpsMode -ErrorAction SilentlyContinue
}
`, path, path)
	runPowerShellScript(15*time.Second, script)
}

// applyChromiumDohPolicy disables secure DNS (DNS-over-HTTPS) for Chrome and Edge via their
// machine policy registry keys, ONLY while at least one domain is actively blocked - otherwise
// a hosts-file block is trivially bypassed by a browser that resolves names through a DoH
// server instead of the OS resolver. Check-before-you-set, mirroring
// usbpolicy_windows.go's "never touch something this mechanism didn't disable" philosophy: if
// a DnsOverHttpsMode value already exists (a real GPO, a prior manual admin change, anything
// not set by this agent), it is left completely alone and never claimed as "ours" - and
// correspondingly, on removal, only a value THIS agent set (tracked in wacState) is ever
// removed.
//
// KNOWN LIMITATION (disclosed, not a bug): this is a best-effort speed bump, not a guarantee.
// A user on a personal VPN, a different network's DNS, or a browser extension the agent has no
// visibility into all bypass this entirely - that is an inherent limit of endpoint-based
// blocking vs. real network/firewall-level blocking, not something more invasive (no kernel
// filter driver, no TLS interception, no anti-VPN measure) is appropriate to build to close it.
func applyChromiumDohPolicy(hasBlocks bool, st *wacState) {
	targets := []struct {
		path    string
		setByUs *bool
	}{
		{`HKLM:\SOFTWARE\Policies\Google\Chrome`, &st.ChromeDohSetByUs},
		{`HKLM:\SOFTWARE\Policies\Microsoft\Edge`, &st.EdgeDohSetByUs},
	}

	for _, t := range targets {
		if hasBlocks {
			if *t.setByUs {
				continue // already off, set by us on a previous run - nothing to do
			}
			if regValueExists(t.path, "DnsOverHttpsMode") {
				// Something else already configured this value - never override or claim it.
				continue
			}
			setChromiumDohOff(t.path)
			*t.setByUs = true
		} else if *t.setByUs {
			removeChromiumDohSetting(t.path)
			*t.setByUs = false
		}
	}
}

// applyFirefoxDohPolicy best-effort merges (or removes) a DNSOverHTTPS-disable entry in
// Firefox's distribution/policies.json. Deliberately never lets a failure here (Firefox not
// installed, file locked, unreadable JSON, etc) propagate in a way that blocks the hosts-file
// blocking in ApplyWacBlocklist above - the caller logs and continues regardless of this
// function's return value.
func applyFirefoxDohPolicy(hasBlocks bool) error {
	programFiles := os.Getenv("ProgramFiles")
	if programFiles == "" {
		programFiles = `C:\Program Files`
	}
	distDir := filepath.Join(programFiles, "Mozilla Firefox", "distribution")
	policiesPath := filepath.Join(distDir, "policies.json")

	if !hasBlocks {
		// Best-effort removal: only clear the DNSOverHTTPS key, leaving any other policy in
		// the file untouched. If the file doesn't exist there's nothing to do.
		data, err := os.ReadFile(policiesPath)
		if err != nil {
			return nil
		}
		var doc map[string]interface{}
		if err := json.Unmarshal(data, &doc); err != nil {
			return nil
		}
		policies, _ := doc["policies"].(map[string]interface{})
		if policies == nil {
			return nil
		}
		if _, ok := policies["DNSOverHTTPS"]; !ok {
			return nil
		}
		delete(policies, "DNSOverHTTPS")
		out, err := json.MarshalIndent(doc, "", "  ")
		if err != nil {
			return nil
		}
		return atomicWriteFile(policiesPath, out)
	}

	// The distribution folder may not exist even when Firefox is installed - create it
	// defensively either way; a failure to do so (permissions, disk issue) is reported but
	// never fatal to the caller.
	if err := os.MkdirAll(distDir, 0o755); err != nil {
		return fmt.Errorf("create firefox distribution dir: %w", err)
	}

	doc := map[string]interface{}{}
	if data, err := os.ReadFile(policiesPath); err == nil {
		// Best-effort parse of whatever is already there so other policies survive the merge;
		// a corrupt existing file just means starting from empty rather than failing outright.
		_ = json.Unmarshal(data, &doc)
	}
	policiesVal, _ := doc["policies"].(map[string]interface{})
	if policiesVal == nil {
		policiesVal = map[string]interface{}{}
	}
	policiesVal["DNSOverHTTPS"] = map[string]interface{}{"Enabled": false, "Locked": false}
	doc["policies"] = policiesVal

	out, err := json.MarshalIndent(doc, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal firefox policies.json: %w", err)
	}
	return atomicWriteFile(policiesPath, out)
}

// ApplyWacBlocklist is called on every heartbeat (unconditionally, even with an empty list -
// same convention as ApplyUsbPolicy) with the server's current list of domains this device's
// assigned staff member should have blocked (see client.go's HeartbeatResponse.WacBlockedDomains,
// populated by /api/agent/heartbeat only when Devices.WebsiteBlockingEnabled is set for this
// device - see run.go). It:
//
//  1. Rewrites a clearly-marked block in the Windows hosts file
//     (C:\Windows\System32\drivers\etc\hosts) mapping each domain (and its www. variant) to
//     0.0.0.0, then flushes the DNS resolver cache so the change takes effect immediately
//     rather than waiting for a stale cache entry to expire.
//  2. Disables Chrome/Edge's built-in DNS-over-HTTPS via machine policy while any domain is
//     blocked (reverted, only for values this agent itself set, once the list is empty again).
//  3. Best-effort merges a matching DNSOverHTTPS-disable policy into Firefox's
//     distribution/policies.json.
//
// Each of the three sub-steps is wrapped so one failing can never prevent the others from
// running; every error is aggregated into a single summary string reported back to the server
// via the heartbeat POST body's wacError field (see client.go's Heartbeat and
// /api/agent/heartbeat/route.ts).
//
// DISCLOSED LIMITATIONS (see applyHostsBlock's and applyChromiumDohPolicy's doc comments for
// detail): exact-hostname-only blocking (bare domain + www. + nothing else), and DoH-disable is
// a best-effort mitigation, not a guarantee - a VPN or a different network's DNS bypasses this
// entirely. This is an inherent limitation of endpoint-based blocking vs. a real firewall, not
// something addressed here with anything more invasive (no kernel filter driver, no TLS
// interception/MITM proxy, no anti-VPN measure) - that is explicitly out of scope.
func ApplyWacBlocklist(client *Client, domains []string) {
	st := loadWacState()

	normalized := make([]string, 0, len(domains))
	seen := map[string]bool{}
	for _, d := range domains {
		d = strings.ToLower(strings.TrimSpace(d))
		if d != "" && !seen[d] {
			seen[d] = true
			normalized = append(normalized, d)
		}
	}

	var errs []string

	if err := applyHostsBlock(normalized); err != nil {
		log.Printf("wac: hosts file update failed: %v", err)
		errs = append(errs, fmt.Sprintf("hosts file: %v", err))
	} else {
		flushDnsCache()
	}

	// Independent of the hosts-file step above and of each other - a failure in one must never
	// skip the rest.
	applyChromiumDohPolicy(len(normalized) > 0, &st)

	if err := applyFirefoxDohPolicy(len(normalized) > 0); err != nil {
		log.Printf("wac: firefox doh policy step failed (non-fatal, hosts-file blocking still applied): %v", err)
		errs = append(errs, fmt.Sprintf("firefox doh policy: %v", err))
	}

	st.Domains = normalized
	saveWacState(st)

	errText := ""
	if len(errs) > 0 {
		errText = strings.Join(errs, "; ")
	}
	setWacStatus(normalized, errText)
}
