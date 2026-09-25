package main

import (
	"encoding/json"
	"regexp"
	"strconv"
	"strings"
)

// Pure parsers for the raw output of each OS's update tooling. No build tags and no process
// execution here, so every one of them is unit-tested with captured output on any platform.

// ---- Windows (tab-separated lines produced by the PowerShell script in updates_windows.go) ----------

// parseWindowsUpdateOutput reads the line protocol emitted by the Windows Update Agent script:
//
//	U <id> <title> <categories;> <msrcSeverity> <kb> <sizeMB> <rebootBehavior 0|1> <type 1=software 2=driver>
//	F <title> <resultCode> <hresult> <date>       latest attempt failed
//	L <date>                                      last successful install
//	D <version> <ageDays>                         Defender signature state
//	E <message>                                   a non-fatal problem during the scan
func parseWindowsUpdateOutput(out string) UpdateScan {
	s := UpdateScan{Supported: true, Complete: true, Family: "windows-update"}
	for _, raw := range strings.Split(out, "\n") {
		line := strings.TrimRight(raw, "\r")
		if line == "" {
			continue
		}
		f := strings.Split(line, "\t")
		switch f[0] {
		case "U":
			if len(f) < 9 {
				continue
			}
			size, _ := strconv.ParseFloat(strings.TrimSpace(f[6]), 64)
			cats := strings.Split(f[3], ";")
			isDriver := strings.TrimSpace(f[8]) == "2"
			u := UpdateItem{
				Key:            f[1],
				Title:          f[2],
				Category:       classifyWindowsUpdate(cats, isDriver, f[2]),
				Severity:       normalizeSeverity(f[4]),
				NewVersion:     kbLabel(f[5]),
				SizeMB:         size,
				RequiresReboot: strings.TrimSpace(f[7]) == "1",
			}
			s.Updates = append(s.Updates, u)
		case "F":
			if len(f) < 5 {
				continue
			}
			s.Failed = append(s.Failed, FailedUpdate{
				Key:   "F:" + f[1],
				Title: f[1],
				Error: "Windows Update result code " + strings.TrimSpace(f[2]) + " (HRESULT " + strings.TrimSpace(f[3]) + ")",
				At:    strings.TrimSpace(f[4]),
			})
		case "L":
			if len(f) >= 2 {
				s.LastInstalledAt = strings.TrimSpace(f[1])
			}
		case "D":
			if len(f) >= 3 {
				d := &UpdateDefinitions{Name: "Microsoft Defender", Version: strings.TrimSpace(f[1])}
				if n, err := strconv.Atoi(strings.TrimSpace(f[2])); err == nil {
					d.AgeDays = &n
				}
				s.Definitions = d
			}
		case "E":
			if len(f) >= 2 {
				s.Warnings = append(s.Warnings, f[1])
				if strings.HasPrefix(f[1], "search:") {
					s.Complete = false
				}
			}
		}
	}
	return s
}

func kbLabel(kb string) string {
	kb = strings.TrimSpace(kb)
	if kb == "" {
		return ""
	}
	return "KB" + kb
}

// classifyWindowsUpdate maps Windows Update categories to this app's categories.
func classifyWindowsUpdate(cats []string, isDriver bool, title string) string {
	all := strings.ToLower(strings.Join(cats, ";") + ";" + title)
	has := func(subs ...string) bool {
		for _, sub := range subs {
			if strings.Contains(all, sub) {
				return true
			}
		}
		return false
	}
	switch {
	case has("firmware"):
		return catFirmware
	case isDriver || has("drivers"):
		return catDriver
	case has("definition update", "security intelligence", "antimalware", "defender"):
		return catDefinition
	case has("security update"):
		return catSecurity
	case has("critical update"):
		return catCritical
	case has("office", "edge", "visual studio", "sql server", ".net", "silverlight", "skype"):
		return catApplication
	default:
		return catOS
	}
}

// normalizeSeverity maps vendor severity words to critical | high | medium | low | none.
func normalizeSeverity(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "critical":
		return "critical"
	case "important", "high":
		return "high"
	case "moderate", "medium":
		return "medium"
	case "low":
		return "low"
	default:
		return "none"
	}
}

// ---- Linux: apt ---------------------------------------------------------------------------------

var aptUpgradableRe = regexp.MustCompile(`^([^/\s]+)/(\S+)\s+(\S+)\s+(\S+)\s+\[upgradable from: ([^\]]+)\]`)

// parseAptUpgradable reads `apt list --upgradable` (run with LC_ALL=C).
func parseAptUpgradable(out string) []UpdateItem {
	var items []UpdateItem
	for _, line := range strings.Split(out, "\n") {
		m := aptUpgradableRe.FindStringSubmatch(strings.TrimSpace(line))
		if m == nil {
			continue
		}
		name, suites, newVer, oldVer := m[1], m[2], m[3], m[5]
		u := UpdateItem{Key: name, Title: name, CurrentVersion: oldVer, NewVersion: newVer, Category: catPackage}
		switch {
		case isKernelPackage(name):
			u.Category, u.RequiresReboot = catKernel, true
			if strings.Contains(suites, "security") {
				u.Severity = "high"
			}
		case strings.Contains(suites, "security"):
			u.Category, u.Severity = catSecurity, "high"
		}
		items = append(items, u)
	}
	return items
}

var kernelPkgRe = regexp.MustCompile(`^(linux-image|linux-headers|linux-modules|linux-generic|linux-signed|linux-aws|linux-azure|linux-gcp|kernel|kernel-core|kernel-modules)(-|$)`)

func isKernelPackage(name string) bool { return kernelPkgRe.MatchString(name) }

// ---- Linux: dnf / yum ---------------------------------------------------------------------------

var rpmArches = map[string]bool{"x86_64": true, "noarch": true, "aarch64": true, "i686": true, "i386": true, "ppc64le": true, "s390x": true, "armv7hl": true}

// parseDnfCheckUpdate reads `dnf -q check-update` / `yum -q check-update`: "name.arch  version  repo".
func parseDnfCheckUpdate(out string) []UpdateItem {
	var items []UpdateItem
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "Obsoleting Packages") {
			break
		}
		f := strings.Fields(line)
		if len(f) != 3 {
			continue
		}
		dot := strings.LastIndex(f[0], ".")
		if dot <= 0 || !rpmArches[f[0][dot+1:]] {
			continue
		}
		name := f[0][:dot]
		u := UpdateItem{Key: name, Title: name, NewVersion: f[1], Category: catPackage}
		if isKernelPackage(name) {
			u.Category, u.RequiresReboot = catKernel, true
		}
		items = append(items, u)
	}
	return items
}

// parseDnfSecurityList reads `dnf -q updateinfo list --security` and returns package name -> severity.
// Line: "RHSA-2024:1234 Important/Sec. openssl-3.0.7-1.el9.x86_64".
func parseDnfSecurityList(out string) map[string]string {
	res := map[string]string{}
	for _, line := range strings.Split(out, "\n") {
		f := strings.Fields(line)
		if len(f) < 3 || !strings.Contains(f[1], "/") {
			continue
		}
		sev := normalizeSeverity(strings.SplitN(f[1], "/", 2)[0])
		if name := rpmNameFromNVRA(f[len(f)-1]); name != "" {
			if cur, ok := res[name]; !ok || severityRank(sev) > severityRank(cur) {
				res[name] = sev
			}
		}
	}
	return res
}

func severityRank(s string) int {
	switch s {
	case "critical":
		return 4
	case "high":
		return 3
	case "medium":
		return 2
	case "low":
		return 1
	}
	return 0
}

// rpmNameFromNVRA strips ".arch" then "-version-release" from "name-version-release.arch".
func rpmNameFromNVRA(nvra string) string {
	if dot := strings.LastIndex(nvra, "."); dot > 0 && rpmArches[nvra[dot+1:]] {
		nvra = nvra[:dot]
	}
	for i := 0; i < 2; i++ {
		dash := strings.LastIndex(nvra, "-")
		if dash <= 0 {
			return nvra
		}
		nvra = nvra[:dash]
	}
	return nvra
}

// markSecurity upgrades matching package updates to category security with the advisory severity.
func markSecurity(items []UpdateItem, sec map[string]string) {
	for i := range items {
		if sev, ok := sec[items[i].Key]; ok {
			if items[i].Category == catPackage {
				items[i].Category = catSecurity
			}
			items[i].Severity = sev
		}
	}
}

// ---- Linux: zypper ------------------------------------------------------------------------------

// parseZypperList reads `zypper -q list-updates`:
// "v | Repository | Name | Current Version | Available Version | Arch".
func parseZypperList(out string) []UpdateItem {
	var items []UpdateItem
	for _, line := range strings.Split(out, "\n") {
		f := strings.Split(line, "|")
		if len(f) < 6 {
			continue
		}
		name := strings.TrimSpace(f[2])
		if name == "" || name == "Name" || strings.HasPrefix(name, "-") {
			continue
		}
		u := UpdateItem{Key: name, Title: name, CurrentVersion: strings.TrimSpace(f[3]), NewVersion: strings.TrimSpace(f[4]), Category: catPackage}
		if isKernelPackage(name) {
			u.Category, u.RequiresReboot = catKernel, true
		}
		items = append(items, u)
	}
	return items
}

// parseZypperSecurityPatches reads `zypper -q list-patches --category security` and returns the patches
// as security updates. Columns: Repository | Name | Category | Severity | Interactive | Status | Since | Summary.
func parseZypperSecurityPatches(out string) []UpdateItem {
	var items []UpdateItem
	for _, line := range strings.Split(out, "\n") {
		f := strings.Split(line, "|")
		if len(f) < 8 {
			continue
		}
		name := strings.TrimSpace(f[1])
		if name == "" || name == "Name" || strings.HasPrefix(name, "-") {
			continue
		}
		items = append(items, UpdateItem{Key: "patch:" + name, Title: strings.TrimSpace(f[7]), NewVersion: name, Category: catSecurity, Severity: normalizeSeverity(f[3])})
	}
	return items
}

// ---- Linux: fwupd (firmware) --------------------------------------------------------------------

// parseFwupdJSON reads `fwupdmgr get-updates --json`.
func parseFwupdJSON(out string) []UpdateItem {
	var doc struct {
		Devices []struct {
			Name     string `json:"Name"`
			DeviceID string `json:"DeviceId"`
			Version  string `json:"Version"`
			Releases []struct {
				Version string `json:"Version"`
				Summary string `json:"Summary"`
				Urgency string `json:"Urgency"`
			} `json:"Releases"`
		} `json:"Devices"`
	}
	if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &doc); err != nil {
		return nil
	}
	var items []UpdateItem
	for _, d := range doc.Devices {
		if len(d.Releases) == 0 {
			continue
		}
		r := d.Releases[0]
		items = append(items, UpdateItem{
			Key: "fwupd:" + d.DeviceID, Title: d.Name + " firmware", CurrentVersion: d.Version, NewVersion: r.Version,
			Category: catFirmware, Severity: normalizeSeverity(r.Urgency), RequiresReboot: true,
		})
	}
	return items
}

// ---- macOS: softwareupdate -----------------------------------------------------------------------

var (
	suLabelRe    = regexp.MustCompile(`^\*\s+Label:\s*(.+)$`)
	suOldItemRe  = regexp.MustCompile(`^\*\s+(.+)$`)
	suTitleRe    = regexp.MustCompile(`Title:\s*([^,]+)`)
	suVersionRe  = regexp.MustCompile(`Version:\s*([^,]+)`)
	suSizeRe     = regexp.MustCompile(`Size:\s*(\d+)\s*(KiB|K|MiB|M|GiB|G)`)
	suOldDetail  = regexp.MustCompile(`^(.*?)\s*\(([^)]+)\),\s*(\d+)\s*(K|KiB|M|MiB)`)
	suRecommend  = regexp.MustCompile(`(?i)Recommended:\s*YES|\[recommended\]`)
	suRestartRe  = regexp.MustCompile(`(?i)Action:\s*restart|\[restart\]`)
)

// parseSoftwareUpdateList reads `softwareupdate -l` in both the current ("* Label: ...") and the
// older ("* name" + "Title (version), 123K [recommended] [restart]") formats.
func parseSoftwareUpdateList(out string) []UpdateItem {
	var items []UpdateItem
	var cur *UpdateItem
	flush := func() {
		if cur != nil && cur.Key != "" {
			items = append(items, *cur)
		}
		cur = nil
	}
	for _, raw := range strings.Split(out, "\n") {
		line := strings.TrimSpace(raw)
		if m := suLabelRe.FindStringSubmatch(line); m != nil {
			flush()
			cur = &UpdateItem{Key: strings.TrimSpace(m[1]), Title: strings.TrimSpace(m[1])}
			continue
		}
		if m := suOldItemRe.FindStringSubmatch(line); m != nil {
			// Older format: "* <label>" starts an item; its detail line follows.
			flush()
			cur = &UpdateItem{Key: strings.TrimSpace(m[1]), Title: strings.TrimSpace(m[1])}
			continue
		}
		if cur == nil {
			continue
		}
		if m := suTitleRe.FindStringSubmatch(line); m != nil {
			cur.Title = strings.TrimSpace(m[1])
			if v := suVersionRe.FindStringSubmatch(line); v != nil {
				cur.NewVersion = strings.TrimSpace(v[1])
			}
			if sz := suSizeRe.FindStringSubmatch(line); sz != nil {
				cur.SizeMB = sizeToMB(sz[1], sz[2])
			}
		} else if d := suOldDetail.FindStringSubmatch(line); d != nil {
			cur.Title, cur.NewVersion = strings.TrimSpace(d[1]), strings.TrimSpace(d[2])
			cur.SizeMB = sizeToMB(d[3], d[4])
		} else {
			continue
		}
		recommended := suRecommend.MatchString(line)
		cur.RequiresReboot = suRestartRe.MatchString(line)
		cur.Category = classifyMacUpdate(cur.Title)
		switch {
		case cur.Category == catSecurity:
			cur.Severity = "high"
		case recommended && cur.Category == catOS:
			cur.Severity = "high"
		case recommended:
			cur.Severity = "medium"
		}
	}
	flush()
	// Anything whose detail line never arrived still needs a category.
	for i := range items {
		if items[i].Category == "" {
			items[i].Category = classifyMacUpdate(items[i].Title)
		}
	}
	return items
}

func sizeToMB(n, unit string) float64 {
	v, _ := strconv.ParseFloat(n, 64)
	switch strings.ToUpper(unit) {
	case "K", "KIB":
		return roundOne(v / 1024)
	case "M", "MIB":
		return roundOne(v)
	case "G", "GIB":
		return roundOne(v * 1024)
	}
	return 0
}

func roundOne(v float64) float64 { return float64(int(v*10+0.5)) / 10 }

func classifyMacUpdate(title string) string {
	t := strings.ToLower(title)
	has := func(subs ...string) bool {
		for _, s := range subs {
			if strings.Contains(t, s) {
				return true
			}
		}
		return false
	}
	switch {
	case has("firmware", "efi", "bridgeos"):
		return catFirmware
	case has("rapid security", "security response", "background security", "security update"):
		return catSecurity
	case has("xprotect", "malware removal", "gatekeeper"):
		return catDefinition
	case has("macos", "mac os x", "os x "):
		return catOS
	case has("command line tools", "xcode"):
		return catPackage
	default:
		return catApplication
	}
}
