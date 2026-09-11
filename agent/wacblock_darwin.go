//go:build darwin

package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
)

// wacStateFile mirrors wacblock_windows.go's own state file, at the same base directory
// config.go's ConfigPath() already uses for macOS/Linux (/etc/logmonitor-agent) - the agent
// runs as root here (a LaunchDaemon, see service_darwin.go), so this directory is already
// writable by it.
const wacStateFile = "/etc/logmonitor-agent/wac-blocked-domains.json"

// wacState is this agent's local record of what it has itself applied, so later runs only
// ever touch hosts-file entries this mechanism itself added - same reasoning as
// wacblock_windows.go's wacState (that version's Chrome/Edge DoH-tracking fields don't apply
// here, see ApplyWacBlocklist's doc comment for why DoH mitigation isn't built for macOS yet).
type wacState struct {
	Domains []string `json:"domains"`
}

func loadWacState() wacState {
	data, err := os.ReadFile(wacStateFile)
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
	_ = os.MkdirAll(filepath.Dir(wacStateFile), 0o755)
	_ = os.WriteFile(wacStateFile, data, 0o644)
}

// wacStatusMu guards the two package-level fields below, which client.go's Heartbeat() reads
// (via WacStatus) on every heartbeat POST - same contract as wacblock_windows.go's version.
var (
	wacStatusMu      sync.Mutex
	wacLastApplied   []string
	wacLastErrorText string
)

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
	hostsFilePathDarwin = "/etc/hosts"
)

// stripManagedBlock removes everything from the begin marker line through the end marker
// line (inclusive), leaving every other line - including anything an admin or another tool
// placed in this file - completely untouched. Identical logic to wacblock_windows.go's
// version (duplicated rather than shared, since that file is windows-only and invisible to
// this build).
func stripManagedBlock(content string) string {
	beginIdx := strings.Index(content, wacHostsBeginMarker)
	if beginIdx == -1 {
		return content
	}
	endIdx := strings.Index(content, wacHostsEndMarker)
	if endIdx == -1 {
		return content[:beginIdx]
	}
	endIdx += len(wacHostsEndMarker)
	for endIdx < len(content) && (content[endIdx] == '\r' || content[endIdx] == '\n') {
		endIdx++
	}
	return content[:beginIdx] + content[endIdx:]
}

// atomicWriteFile writes to a temp file in the same directory as path, then renames over the
// original, so a crash mid-write can never leave /etc/hosts half-written.
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
	// os.CreateTemp defaults to 0600 - explicitly widen to the standard 0644 /etc/hosts
	// permissions before the rename, or every non-root process on the machine would lose the
	// ability to read it.
	if err := os.Chmod(tmpName, 0o644); err != nil {
		os.Remove(tmpName)
		return err
	}
	if err := os.Rename(tmpName, path); err != nil {
		os.Remove(tmpName)
		return err
	}
	return nil
}

// applyHostsBlock rewrites the managed block in /etc/hosts to contain exactly the given
// domains (127.0.0.1 for the bare domain plus its www. variant, unless the domain already
// starts with www.), or removes the block entirely when domains is empty. Never touches
// anything outside the markers.
//
// KNOWN LIMITATION (disclosed, not a bug) - same as wacblock_windows.go's applyHostsBlock:
// this can only block the exact hostnames listed here, not true wildcard-subdomain suffix
// matching. A blocked "example.com" stops "example.com" and "www.example.com", but not
// "m.example.com" or any other subdomain not separately enumerated.
func applyHostsBlock(domains []string) error {
	existing, err := os.ReadFile(hostsFilePathDarwin)
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
			b.WriteString("\n")
		}
		b.WriteString(wacHostsBeginMarker + "\n")
		for _, d := range domains {
			b.WriteString(fmt.Sprintf("127.0.0.1 %s\n", d))
			if !strings.HasPrefix(d, "www.") {
				b.WriteString(fmt.Sprintf("127.0.0.1 www.%s\n", d))
			}
		}
		b.WriteString(wacHostsEndMarker + "\n")
		newContent = b.String()
	}

	return atomicWriteFile(hostsFilePathDarwin, []byte(newContent))
}

// flushDnsCache clears macOS's DNS resolver cache so a hosts-file change takes effect
// immediately instead of waiting for a cached record to expire. This two-command sequence
// (dscacheutil, then signaling mDNSResponder to reload) is the standard, documented way to
// do this on every currently-supported macOS release - older per-version alternatives
// (lookupd, discoveryutil) are obsolete and not needed.
func flushDnsCache() {
	if err := exec.Command("dscacheutil", "-flushcache").Run(); err != nil {
		log.Printf("wac: dscacheutil -flushcache failed: %v", err)
	}
	if err := exec.Command("killall", "-HUP", "mDNSResponder").Run(); err != nil {
		log.Printf("wac: killall -HUP mDNSResponder failed: %v", err)
	}
}

// ApplyWacBlocklist is macOS's equivalent of wacblock_windows.go's function of the same name
// - same contract (called on every heartbeat, even with an empty list - see run.go), same
// hosts-file mechanism and local state-tracking approach.
//
// DISCLOSED LIMITATION, not an oversight: this deliberately does NOT include that file's
// Chrome/Edge/Firefox DNS-over-HTTPS mitigation step. On macOS, Chrome/Edge enterprise policy
// normally requires a signed MDM configuration profile, which this agent has no
// infrastructure to generate; Firefox's distribution/policies.json mechanism does exist on
// macOS too and could be added later the same way wacblock_windows.go does it, but is left
// out of this first version to keep it small and testable. Hosts-file blocking plus a DNS
// cache flush is the same core, load-bearing protection Windows provides - a user actively
// using DNS-over-HTTPS bypasses it exactly the same way the Windows version's own disclosure
// already describes; this isn't a new gap, just one not yet mitigated on this platform.
func ApplyWacBlocklist(client *Client, domains []string) {
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

	saveWacState(wacState{Domains: normalized})

	errText := ""
	if len(errs) > 0 {
		errText = strings.Join(errs, "; ")
	}
	setWacStatus(normalized, errText)
}
