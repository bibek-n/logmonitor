//go:build windows

package main

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Runs far more often than iisPollInterval (see iis.go) - request-rate freshness for DDoS
// detection needs it, and unlike CollectIisStatus's script this one does no HTTP probing or
// certificate reads, so paying this cost every 20s doesn't risk delaying heartbeats the way
// running the heavy script that often would.
const weblogTailInterval = 20 * time.Second

// A batch this large in one tick would only happen from a genuinely large traffic spike (or a
// misconfigured huge historical backlog on first run, which startPos handling below already
// avoids) - capped so one busy site can't turn the agent's own upload into an unbounded burst.
const weblogMaxEventsPerBatch = 500

var weblogFileNamePattern = regexp.MustCompile(`(?i)^u_ex\d{6}(_x)?\.log$`)

// IIS's own default field order, used only when a read window never happens to include the
// file's own #Fields: header - matches IIS_DEFAULT_FIELDS in the server-side reference
// implementation (iisAccessLogAdapter.ts) exactly, on purpose.
var weblogDefaultFields = []string{
	"date", "time", "s-ip", "cs-method", "cs-uri-stem", "cs-uri-query", "s-port",
	"cs-username", "c-ip", "cs(User-Agent)", "cs(Referer)", "sc-status", "sc-substatus", "sc-win32-status", "time-taken",
}

type siteTailState struct {
	FileName string `json:"fileName"`
	Position int64  `json:"position"`
	FileSize int64  `json:"fileSize"`
}

func weblogStatePath() string {
	return filepath.Join(filepath.Dir(ConfigPath()), "weblog-state.json")
}

func loadWeblogState() map[string]*siteTailState {
	data, err := os.ReadFile(weblogStatePath())
	if err != nil {
		return map[string]*siteTailState{}
	}
	var state map[string]*siteTailState
	if err := json.Unmarshal(data, &state); err != nil {
		return map[string]*siteTailState{}
	}
	return state
}

func saveWeblogState(state map[string]*siteTailState) {
	data, err := json.Marshal(state)
	if err != nil {
		return
	}
	_ = os.WriteFile(weblogStatePath(), data, 0600)
}

type siteLogDir struct {
	Name      string `json:"Name"`
	ID        int    `json:"Id"`
	LogDirRaw string `json:"LogDirectory"`
}

const discoverSiteLogDirsScript = `
Import-Module WebAdministration -ErrorAction SilentlyContinue
$sites = @()
foreach ($site in (Get-ChildItem IIS:\Sites -ErrorAction SilentlyContinue)) {
  $logDir = $null
  try {
    $logFile = Get-ItemProperty "IIS:\Sites\$($site.Name)" -Name logFile -ErrorAction Stop
    if ($logFile -and $logFile.directory) { $logDir = [System.Environment]::ExpandEnvironmentVariables($logFile.directory) }
  } catch {}
  $sites += [PSCustomObject]@{ Name = $site.Name; Id = $site.Id; LogDirectory = $logDir }
}
$sites | ConvertTo-Json -Compress
`

func discoverSiteLogDirs() []siteLogDir {
	raw := runPowerShellScript(30*time.Second, discoverSiteLogDirsScript)
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	var sites []siteLogDir
	// A single site comes back as a bare object, not an array - ConvertTo-Json only wraps
	// in [] once there's more than one item.
	if strings.HasPrefix(strings.TrimSpace(raw), "[") {
		_ = json.Unmarshal([]byte(raw), &sites)
	} else {
		var one siteLogDir
		if err := json.Unmarshal([]byte(raw), &one); err == nil {
			sites = []siteLogDir{one}
		}
	}
	return sites
}

func pickNewestLogFile(dir string) (name string, size int64, ok bool) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return "", 0, false
	}
	var newestName string
	var newestSize int64
	var newestMod time.Time
	for _, e := range entries {
		if e.IsDir() || !weblogFileNamePattern.MatchString(e.Name()) {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		if newestName == "" || info.ModTime().After(newestMod) {
			newestName = e.Name()
			newestSize = info.Size()
			newestMod = info.ModTime()
		}
	}
	if newestName == "" {
		return "", 0, false
	}
	return newestName, newestSize, true
}

func parseFieldsHeader(line string) []string {
	if !strings.HasPrefix(line, "#Fields:") {
		return nil
	}
	return strings.Fields(strings.TrimPrefix(line, "#Fields:"))
}

func cleanField(v string) string {
	if v == "" || v == "-" {
		return ""
	}
	return v
}

func parseWeblogLine(line string, fields []string) *weblogEvent {
	values := strings.Split(line, " ")
	if len(values) < 3 {
		return nil
	}
	record := map[string]string{}
	for i, f := range fields {
		if i < len(values) {
			record[f] = values[i]
		} else {
			record[f] = "-"
		}
	}

	eventTime := time.Now().UTC().Format(time.RFC3339)
	if d, t := record["date"], record["time"]; d != "" && t != "" {
		if parsed, err := time.Parse("2006-01-02T15:04:05", d+"T"+t); err == nil {
			eventTime = parsed.UTC().Format(time.RFC3339)
		}
	}

	var status *int
	if s := cleanField(record["sc-status"]); s != "" {
		if n, err := strconv.Atoi(s); err == nil {
			status = &n
		}
	}
	var timeTaken *int
	if s := cleanField(record["time-taken"]); s != "" {
		if n, err := strconv.Atoi(s); err == nil {
			timeTaken = &n
		}
	}
	requestPath := cleanField(record["cs-uri-stem"])
	if q := cleanField(record["cs-uri-query"]); q != "" {
		requestPath += "?" + q
	}
	userAgent := cleanField(record["cs(User-Agent)"])
	if userAgent != "" {
		userAgent = strings.ReplaceAll(userAgent, "+", " ")
	}

	return &weblogEvent{
		EventTime:      eventTime,
		SourceIP:       cleanField(record["c-ip"]),
		RequestMethod:  cleanField(record["cs-method"]),
		RequestPath:    requestPath,
		ResponseStatus: status,
		UserAgent:      userAgent,
		UserAccount:    cleanField(record["cs-username"]),
		TimeTakenMs:    timeTaken,
	}
}

// tailSite reads whatever's new in this site's current log file since the last tracked
// position - same resumption/rotation-detection contract as the server-side reference
// implementation (iisAccessLogAdapter.ts): only complete lines are consumed, rotation is
// detected by filename change or a size shrink, and a missing directory/file is a silent
// no-op (logging disabled for this site, or IIS hasn't written a file yet) rather than an
// error. The one deliberate difference: state == nil (never tailed this site before) starts
// from the file's current end, not position 0 - a site with days of existing history
// shouldn't get replayed as one giant burst the first time this feature reaches a server.
func tailSite(dir siteLogDir, state *siteTailState) ([]weblogEvent, *siteTailState) {
	if dir.LogDirRaw == "" {
		return nil, state
	}
	logPath := filepath.Join(dir.LogDirRaw, "W3SVC"+strconv.Itoa(dir.ID))
	name, size, ok := pickNewestLogFile(logPath)
	if !ok {
		return nil, state
	}

	var startPos int64
	switch {
	case state == nil:
		startPos = size
	case state.FileName != name || (state.FileSize > 0 && size < state.FileSize):
		startPos = 0
	default:
		startPos = state.Position
	}

	if size <= startPos {
		return nil, &siteTailState{FileName: name, Position: startPos, FileSize: size}
	}

	full := filepath.Join(logPath, name)
	f, err := os.Open(full)
	if err != nil {
		return nil, state
	}
	defer f.Close()

	buf := make([]byte, size-startPos)
	n, err := f.ReadAt(buf, startPos)
	if err != nil && n == 0 {
		return nil, state
	}
	text := string(buf[:n])
	lastNewline := strings.LastIndex(text, "\n")
	if lastNewline == -1 {
		// No complete line yet in this window - leave position where it was and try again
		// next tick once the rest of the line has been written.
		return nil, state
	}
	complete := text[:lastNewline]
	consumed := int64(len(text[:lastNewline+1]))

	fields := weblogDefaultFields
	var events []weblogEvent
	for _, line := range strings.Split(complete, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "#") {
			if parsed := parseFieldsHeader(line); parsed != nil {
				fields = parsed
			}
			continue
		}
		if ev := parseWeblogLine(line, fields); ev != nil {
			events = append(events, *ev)
		}
	}

	return events, &siteTailState{FileName: name, Position: startPos + consumed, FileSize: size}
}

func runWeblogTailing(client *Client, stop <-chan struct{}) {
	ticker := time.NewTicker(weblogTailInterval)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			if !IisDetected() {
				continue
			}
			sites := discoverSiteLogDirs()
			if len(sites) == 0 {
				continue
			}
			state := loadWeblogState()
			stateChanged := false
			for _, site := range sites {
				events, newState := tailSite(site, state[site.Name])

				if len(events) == 0 {
					if newState != nil && newState != state[site.Name] {
						state[site.Name] = newState
						stateChanged = true
					}
					continue
				}

				if len(events) > weblogMaxEventsPerBatch {
					log.Printf("weblog: site %q produced %d events in one tick, capping to %d (rate cap, not a failure)", site.Name, len(events), weblogMaxEventsPerBatch)
					events = events[:weblogMaxEventsPerBatch]
				}

				if err := client.PostWeblogEvents(site.Name, events); err != nil {
					log.Printf("weblog: failed to post %d event(s) for site %q: %v", len(events), site.Name, err)
					// Deliberately don't advance this site's tracked position - leave it as
					// it was before this tick so the same bytes are retried next tick
					// instead of being silently lost to a transient network error.
					continue
				}
				state[site.Name] = newState
				stateChanged = true
			}
			if stateChanged {
				saveWeblogState(state)
			}
		}
	}
}
