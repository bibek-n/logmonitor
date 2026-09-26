package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
)

// Admin-approved update installation.
//
// Safety rules (every one is enforced HERE, on the device, independent of what the server says):
//  1. The agent only ever runs fixed native update commands for updates the admin ticked - never a script body.
//  2. Disruptive updates (OS-level, kernel, firmware, critical, or anything needing a restart) are REFUSED unless the
//     request carries AllowDisruptive, which the server only sets after an explicit administrator confirmation.
//  3. The agent NEVER restarts the machine. If a restart is needed it says so; restarting stays the separate,
//     confirmed power action.
//  4. At-most-once: the server is told "running" BEFORE anything executes (and only proceeds if that succeeded), and an
//     on-disk marker stops a restarted agent from re-running the same request.
//  5. Package names / labels are validated and passed as separate arguments (no shell), so a hostile update key can
//     never inject a command.

// Outcomes reported per update.
const (
	outcomeInstalled = "installed"
	outcomeFailed    = "failed"
	outcomeRefused   = "refused"
	outcomeSkipped   = "skipped"
)

// InstallItemResult is the result for one requested update.
type InstallItemResult struct {
	Key     string `json:"key"`
	Title   string `json:"title"`
	Outcome string `json:"outcome"`
	Message string `json:"message"`
}

// InstallResult is posted to /api/agent/update-result. Status: running | done | failed | partial | refused | interrupted.
type InstallResult struct {
	RequestID      int                 `json:"requestId"`
	Status         string              `json:"status"`
	Items          []InstallItemResult `json:"items"`
	RebootRequired bool                `json:"rebootRequired"`
	Output         string              `json:"output"`
}

const maxInstallKeys = 200

var updateInstallRunning int32

// ---- planning (pure) ---------------------------------------------------------------------------------------------

// planInstall decides which requested updates may run. pending is a FRESH scan taken on the device, so the disruptive
// flags come from the device itself, not from the request.
func planInstall(pending []UpdateItem, keys []string, allowDisruptive bool) (ok []UpdateItem, results []InstallItemResult) {
	byKey := make(map[string]UpdateItem, len(pending))
	for _, p := range pending {
		byKey[p.Key] = p
	}
	seen := map[string]bool{}
	for _, k := range keys {
		if len(seen) >= maxInstallKeys {
			break
		}
		k = strings.TrimSpace(k)
		if k == "" || seen[k] {
			continue
		}
		seen[k] = true
		item, found := byKey[k]
		switch {
		case !found:
			results = append(results, InstallItemResult{Key: k, Title: k, Outcome: outcomeSkipped, Message: "no longer pending on this device (already installed or superseded)"})
		case isDisruptiveUpdate(item) && !allowDisruptive:
			results = append(results, InstallItemResult{Key: k, Title: item.Title, Outcome: outcomeRefused, Message: "disruptive update (OS, kernel, firmware, critical or restart-requiring) - needs administrator confirmation"})
		default:
			ok = append(ok, item)
		}
	}
	return ok, results
}

// ---- validation (pure) -------------------------------------------------------------------------------------------

var (
	pkgNameRe   = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9+._:~-]{0,127}$`)
	guidRe      = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
	fwupdIDRe   = regexp.MustCompile(`^[0-9A-Za-z._-]{1,128}$`)
	patchNameRe = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`)
)

func validPackageName(s string) bool { return pkgNameRe.MatchString(s) }
func validGUID(s string) bool        { return guidRe.MatchString(s) }

// validMacLabel allows what softwareupdate labels actually contain (letters, digits, spaces, dots, dashes, underscores,
// parentheses, plus) and nothing that could be read as an option or control character.
func validMacLabel(s string) bool {
	if s == "" || len(s) > 200 || strings.HasPrefix(s, "-") {
		return false
	}
	for _, r := range s {
		if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || strings.ContainsRune(" .-_()+", r)) {
			return false
		}
	}
	return true
}

// ---- command builders (pure; no shell, arguments are separate strings) ------------------------------------------------

// installCommand is one fixed command to run for one update.
type installCommand struct {
	Key  string
	Name string
	Args []string
	Env  []string
}

// buildLinuxInstallCommands returns one command per update so each gets its own outcome.
func buildLinuxInstallCommands(family string, items []UpdateItem) ([]installCommand, []InstallItemResult) {
	var cmds []installCommand
	var rejected []InstallItemResult
	reject := func(it UpdateItem, why string) {
		rejected = append(rejected, InstallItemResult{Key: it.Key, Title: it.Title, Outcome: outcomeRefused, Message: why})
	}
	for _, it := range items {
		switch {
		case strings.HasPrefix(it.Key, "fwupd:"):
			id := strings.TrimPrefix(it.Key, "fwupd:")
			if !fwupdIDRe.MatchString(id) {
				reject(it, "invalid firmware device id")
				continue
			}
			cmds = append(cmds, installCommand{Key: it.Key, Name: "fwupdmgr", Args: []string{"update", id, "-y", "--no-reboot-check"}})
		case strings.HasPrefix(it.Key, "patch:"):
			name := strings.TrimPrefix(it.Key, "patch:")
			if family != "zypper" || !patchNameRe.MatchString(name) {
				reject(it, "invalid patch name")
				continue
			}
			cmds = append(cmds, installCommand{Key: it.Key, Name: "zypper", Args: []string{"--non-interactive", "install", "-t", "patch", name}})
		default:
			if !validPackageName(it.Key) {
				reject(it, "invalid package name")
				continue
			}
			switch family {
			case "apt":
				cmds = append(cmds, installCommand{Key: it.Key, Name: "apt-get", Env: []string{"DEBIAN_FRONTEND=noninteractive", "LC_ALL=C"},
					Args: []string{"install", "-y", "--only-upgrade", "-o", "Dpkg::Options::=--force-confold", "-o", "Dpkg::Options::=--force-confdef", it.Key}})
			case "dnf":
				cmds = append(cmds, installCommand{Key: it.Key, Name: "dnf", Args: []string{"-y", "upgrade", it.Key}, Env: []string{"LC_ALL=C"}})
			case "yum":
				cmds = append(cmds, installCommand{Key: it.Key, Name: "yum", Args: []string{"-y", "update", it.Key}, Env: []string{"LC_ALL=C"}})
			case "zypper":
				cmds = append(cmds, installCommand{Key: it.Key, Name: "zypper", Args: []string{"--non-interactive", "update", it.Key}, Env: []string{"LC_ALL=C"}})
			default:
				reject(it, "unsupported package manager: "+family)
			}
		}
	}
	return cmds, rejected
}

// buildMacInstallCommands: `softwareupdate -i <label>` per update. Deliberately never `-R`/`--restart`.
func buildMacInstallCommands(items []UpdateItem) ([]installCommand, []InstallItemResult) {
	var cmds []installCommand
	var rejected []InstallItemResult
	for _, it := range items {
		if !validMacLabel(it.Key) {
			rejected = append(rejected, InstallItemResult{Key: it.Key, Title: it.Title, Outcome: outcomeRefused, Message: "invalid update label"})
			continue
		}
		cmds = append(cmds, installCommand{Key: it.Key, Name: "softwareupdate", Args: []string{"-i", it.Key}})
	}
	return cmds, rejected
}

// ---- Windows (line protocol from the script in updates_install_exec.go) -------------------------------------------------

// parseWindowsInstallOutput reads:
//
//	R <updateId> <resultCode> <hresult> <title>     resultCode: 2 succeeded, 3 succeeded with errors, 4 failed, 5 aborted
//	D <updateId> <message>                          download/accept problem for that update
//	B <True|False>                                  a restart is required
//	E <message>                                     a fatal problem
func parseWindowsInstallOutput(out string, items []UpdateItem) ([]InstallItemResult, bool, string) {
	titles := map[string]string{}
	for _, it := range items {
		titles[it.Key] = it.Title
	}
	got := map[string]InstallItemResult{}
	reboot := false
	fatal := ""
	for _, raw := range strings.Split(out, "\n") {
		f := strings.Split(strings.TrimRight(raw, "\r"), "\t")
		switch f[0] {
		case "R":
			if len(f) < 4 {
				continue
			}
			code, _ := strconv.Atoi(strings.TrimSpace(f[2]))
			r := InstallItemResult{Key: f[1], Title: titles[f[1]]}
			switch code {
			case 2:
				r.Outcome, r.Message = outcomeInstalled, "installed"
			case 3:
				r.Outcome, r.Message = outcomeInstalled, "installed with warnings (HRESULT "+strings.TrimSpace(f[3])+")"
			default:
				r.Outcome, r.Message = outcomeFailed, fmt.Sprintf("Windows Update result code %d (HRESULT %s)", code, strings.TrimSpace(f[3]))
			}
			got[f[1]] = r
		case "D":
			if len(f) >= 3 {
				got[f[1]] = InstallItemResult{Key: f[1], Title: titles[f[1]], Outcome: outcomeFailed, Message: f[2]}
			}
		case "B":
			reboot = len(f) >= 2 && strings.EqualFold(strings.TrimSpace(f[1]), "true")
		case "E":
			if len(f) >= 2 {
				fatal = f[1]
			}
		}
	}
	var results []InstallItemResult
	for _, it := range items {
		if r, ok := got[it.Key]; ok {
			if r.Title == "" {
				r.Title = it.Title
			}
			results = append(results, r)
			continue
		}
		msg := "no result reported"
		if fatal != "" {
			msg = fatal
		}
		results = append(results, InstallItemResult{Key: it.Key, Title: it.Title, Outcome: outcomeFailed, Message: msg})
	}
	return results, reboot, fatal
}

// ---- in-flight marker (at-most-once across agent restarts) ------------------------------------------------------------

type inflightMarker struct {
	RequestID int    `json:"requestId"`
	StartedAt string `json:"startedAt"`
}

// inflightPath is a variable so tests can point it at a temp dir.
var inflightPath = func() string { return filepath.Join(filepath.Dir(ConfigPath()), "update-install-inflight.json") }

func writeInflight(id int) {
	b, _ := json.Marshal(inflightMarker{RequestID: id, StartedAt: time.Now().UTC().Format(time.RFC3339)})
	_ = os.MkdirAll(filepath.Dir(inflightPath()), 0o755)
	_ = os.WriteFile(inflightPath(), b, 0o600)
}

func readInflight() *inflightMarker {
	b, err := os.ReadFile(inflightPath())
	if err != nil {
		return nil
	}
	var m inflightMarker
	if json.Unmarshal(b, &m) != nil || m.RequestID == 0 {
		return nil
	}
	return &m
}

func clearInflight() { _ = os.Remove(inflightPath()) }

// ---- orchestration ------------------------------------------------------------------------------------------------------

// RunUpdateInstall executes one approved install request. It reports "running" first and only continues if that
// report was accepted - so a request can never run twice, and an agent that can't reach the server never installs blind.
func RunUpdateInstall(client *Client, req UpdateRequest) {
	if !atomic.CompareAndSwapInt32(&updateInstallRunning, 0, 1) {
		return // another install is in progress; the server keeps this request until it is marked running
	}
	defer atomic.StoreInt32(&updateInstallRunning, 0)

	if m := readInflight(); m != nil && m.RequestID == req.ID {
		// Seen before and never finished (agent restarted mid-install): report it, never repeat it.
		_ = client.PostUpdateResult(InstallResult{RequestID: req.ID, Status: "interrupted", Items: []InstallItemResult{}, Output: "The agent restarted while this install was running; it was not repeated. Rescan to see the current state."})
		clearInflight()
		return
	}

	if err := client.PostUpdateResult(InstallResult{RequestID: req.ID, Status: "running", Items: []InstallItemResult{}}); err != nil {
		log.Printf("update install %d: could not report running, not starting: %v", req.ID, err)
		return
	}
	writeInflight(req.ID)
	defer clearInflight()

	scan := CollectUpdates()
	install, results := planInstall(scan.Updates, req.UpdateKeys, req.AllowDisruptive)

	var reboot bool
	var output string
	if len(install) > 0 {
		var ran []InstallItemResult
		ran, reboot, output = installPlatform(scan.Family, install)
		results = append(results, ran...)
	}

	status := summarizeStatus(results, len(install) > 0)
	final := InstallResult{RequestID: req.ID, Status: status, Items: results, RebootRequired: reboot, Output: tail(output, 4000)}
	if err := client.PostUpdateResult(final); err != nil {
		log.Printf("update install %d: result upload failed: %v", req.ID, err)
	}
	log.Printf("update install %d finished: %s (%d item(s), reboot=%v)", req.ID, status, len(results), reboot)

	// Refresh the server's view of what is still pending.
	RunUpdateScan(client, "post-install", 0)
}

func summarizeStatus(results []InstallItemResult, ranAnything bool) string {
	installed, failed, refused := 0, 0, 0
	for _, r := range results {
		switch r.Outcome {
		case outcomeInstalled:
			installed++
		case outcomeFailed:
			failed++
		case outcomeRefused:
			refused++
		}
	}
	switch {
	case failed == 0 && refused == 0:
		return "done"
	case installed == 0 && !ranAnything && refused > 0:
		return "refused"
	case installed == 0:
		return "failed"
	default:
		return "partial"
	}
}

func tail(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return "..." + s[len(s)-n:]
}

// reportInterruptedInstall runs once at agent start: a leftover marker means the previous process died mid-install.
func reportInterruptedInstall(client *Client) {
	m := readInflight()
	if m == nil {
		return
	}
	if err := client.PostUpdateResult(InstallResult{RequestID: m.RequestID, Status: "interrupted", Items: []InstallItemResult{}, Output: "The agent stopped while this install was running (started " + m.StartedAt + "); it was not repeated."}); err == nil {
		clearInflight()
	}
}
