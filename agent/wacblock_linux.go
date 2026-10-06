//go:build linux

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

// wacStateFile mirrors wacblock_darwin.go's own state file, at the same base directory
// config.go's ConfigPath() already uses for macOS/Linux (/etc/logmonitor-agent) - the agent
// runs as root here (a systemd service, see service_linux.go), so this directory is already
// writable by it.
const wacStateFile = "/etc/logmonitor-agent/wac-blocked-domains.json"

// wacState is this agent's local record of what it has itself applied, so later runs only
// ever touch hosts-file entries this mechanism itself added - same reasoning as
// wacblock_windows.go/wacblock_darwin.go's wacState.
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
// (via WacStatus) on every heartbeat POST - same contract as wacblock_windows.go/
// wacblock_darwin.go's version.
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
	hostsFilePathLinux  = "/etc/hosts"
)

// stripManagedBlock removes everything from the begin marker line through the end marker
// line (inclusive), leaving every other line - including anything an admin or another tool
// placed in this file - completely untouched. Identical logic to wacblock_windows.go/
// wacblock_darwin.go's version (duplicated rather than shared, since those files are platform-
// gated and invisible to this build).
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
// KNOWN LIMITATION (disclosed, not a bug) - same as wacblock_windows.go/wacblock_darwin.go's
// applyHostsBlock: this can only block the exact hostnames listed here, not true wildcard-
// subdomain suffix matching. A blocked "example.com" stops "example.com" and
// "www.example.com", but not "m.example.com" or any other subdomain not separately
// enumerated - the server-side rules engine already sends each distinct subdomain it wants
// blocked as its own entry in the domains list for exactly this reason.
func applyHostsBlock(domains []string) error {
	existing, err := os.ReadFile(hostsFilePathLinux)
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

	return atomicWriteFile(hostsFilePathLinux, []byte(newContent))
}

// flushDnsCache clears whatever local DNS cache this distro happens to be running, so a
// hosts-file change takes effect immediately instead of waiting for a cached record to
// expire. Unlike macOS (always dscacheutil/mDNSResponder) or Windows (always ipconfig),
// Linux has no single universal caching layer - most desktop distros ship systemd-resolved
// (flushed via resolvedctl/systemd-resolve), some run nscd instead, and plenty run neither at
// all (glibc's NSS reads /etc/hosts directly on every lookup with nothing cached in front of
// it, so there's nothing to flush - not an error, just a no-op). Tries each known mechanism
// best-effort and silently moves on if a given command doesn't exist on this box; never
// treated as a hard failure of the block itself, matching this file's established "DNS cache
// flush is a nice-to-have, hosts-file write is the load-bearing part" philosophy.
func flushDnsCache() {
	if _, err := exec.LookPath("resolvectl"); err == nil {
		if err := exec.Command("resolvectl", "flush-caches").Run(); err != nil {
			log.Printf("wac: resolvectl flush-caches failed: %v", err)
		}
		return
	}
	if _, err := exec.LookPath("systemd-resolve"); err == nil {
		if err := exec.Command("systemd-resolve", "--flush-caches").Run(); err != nil {
			log.Printf("wac: systemd-resolve --flush-caches failed: %v", err)
		}
		return
	}
	if _, err := exec.LookPath("nscd"); err == nil {
		if err := exec.Command("nscd", "-i", "hosts").Run(); err != nil {
			log.Printf("wac: nscd -i hosts failed: %v", err)
		}
	}
}

// ApplyWacBlocklist is Linux's equivalent of wacblock_windows.go/wacblock_darwin.go's
// function of the same name - same contract (called on every heartbeat, even with an empty
// list - see run.go), same hosts-file mechanism and local state-tracking approach. Fills the
// gap documented in wacblock_other.go's old comment ("Website Access Control enforcement has
// no Linux implementation yet") - that file's build tag now excludes linux so this is the
// real implementation used instead.
//
// DISCLOSED LIMITATION, not an oversight: this deliberately does NOT include
// wacblock_windows.go's Chrome/Edge/Firefox DNS-over-HTTPS mitigation step (no equivalent
// enterprise-policy mechanism wired up for Linux browsers here yet, same reasoning
// wacblock_darwin.go's own comment already gives for macOS). Hosts-file blocking plus a
// best-effort DNS cache flush is the same core, load-bearing protection the other two
// platforms provide - a user actively using DNS-over-HTTPS bypasses it exactly the same way
// those platforms' own disclosures already describe; this isn't a new gap, just one not yet
// mitigated on this platform either.
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
