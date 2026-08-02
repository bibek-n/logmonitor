//go:build !legacy_win7

package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

// Browser Activity Audit: reads each local user's Chrome/Edge/Firefox history database
// directly off disk (never a browser extension - see the approved plan for why) and ships
// {browser, domain, pageTitle, visitedAt, dwellSeconds} tuples to the server. Only ever
// active when the server's heartbeat response carries a non-nil
// BrowserActivityIntervalMinutes for this device (see run.go) - an admin must explicitly
// enable it per device, same opt-in guarantee ScreenshotIntervalMinutes already gives.
//
// Excluded from the legacy Windows 7 build (see go.mod.win7's header comment and
// .github/workflows/agent-release.yml's build-win7 job, which passes -tags legacy_win7) -
// modernc.org/sqlite isn't pinned in that dependency set and this collector is not worth
// forcing into it.
const (
	// A hand-planted domain visit is never actually multi-minute; this bounds an
	// overnight-open tab from inflating a dwell estimate, matching
	// src/lib/browserActivity/dwellTime.ts's DEFAULT_CAP_SECONDS exactly.
	browserHistoryDwellCapSeconds = 1800
	// Per source (one Chrome/Edge/Firefox profile), bounds a single poll's DB read - a
	// heavy user's lifetime history is irrelevant per-poll; only the newest rows since the
	// last cursor matter, and this also bounds a first-run cursor-seed query's result set.
	browserHistoryMaxRowsPerSource = 1000
	// Mirrors ingestBrowserActivitySchema's own cap (schema.ts) - if a poll somehow produces
	// more than the server will accept in one batch (many profiles across many users all
	// gaining history since the last poll), keep only the most recent and say so rather than
	// silently dropping the rest.
	browserHistoryMaxEventsPerBatch = 500

	// Seconds between the Unix epoch (1970-01-01) and the Windows/Chrome epoch
	// (1601-01-01) - Chrome's visit_time column is microseconds since the latter.
	chromeEpochDeltaMicro = int64(11644473600) * 1_000_000

	// Seconds between the Unix epoch (1970-01-01) and the "Mac absolute time" / Core Data
	// epoch (2001-01-01) - Safari's history_visits.visit_time column is (fractional) seconds
	// since the latter.
	safariEpochDeltaSeconds = int64(978307200)
)

// browserActivityEventPayload is the wire shape posted to /api/agent/browser-activity -
// deliberately narrow, matching RawBrowserActivityEvent in
// src/lib/browserActivity/types.ts exactly. No raw URL field exists here at all: Domain is
// derived once in bareDomainFromURL and the source URL string is never retained afterward.
type browserActivityEventPayload struct {
	Browser      string  `json:"browser"`
	Domain       string  `json:"domain"`
	PageTitle    *string `json:"pageTitle"`
	VisitedAt    string  `json:"visitedAt"`
	DwellSeconds *int    `json:"dwellSeconds"`
}

// rawVisit is the agent-internal intermediate shape, one row read from a browser's history
// database, before exclusion filtering and dwell computation.
type rawVisit struct {
	Browser   string
	Domain    string
	Title     string
	VisitedAt time.Time
}

// --- Cursor state (per browser profile, persisted across restarts) ----------------------

type browserActivityState struct {
	// Keyed by "<username>|<browser>|<historyFilePath>" -> last-sent visit timestamp, in
	// the same raw units the source DB stores it in (Chrome/Edge WebKit-epoch microseconds,
	// Firefox PRTime microseconds) so no lossy conversion happens on every poll.
	Cursors map[string]int64 `json:"cursors"`
}

func browserActivityStatePath() string {
	return filepath.Join(filepath.Dir(ConfigPath()), "browser-activity-state.json")
}

func loadBrowserActivityState() *browserActivityState {
	data, err := os.ReadFile(browserActivityStatePath())
	if err != nil {
		return &browserActivityState{Cursors: map[string]int64{}}
	}
	var st browserActivityState
	if err := json.Unmarshal(data, &st); err != nil || st.Cursors == nil {
		return &browserActivityState{Cursors: map[string]int64{}}
	}
	return &st
}

func saveBrowserActivityState(st *browserActivityState) {
	path := browserActivityStatePath()
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return
	}
	data, err := json.MarshalIndent(st, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(path, data, 0600)
}

func cursorKey(username, browser, path string) string {
	return username + "|" + browser + "|" + path
}

// --- Profile discovery -------------------------------------------------------------------
//
// Iterates every local user's profile directory (not just whoever is currently logged in) -
// a device can be shared, or enrollment/heartbeat can run under a different session than
// whoever was browsing, so scoping to "current user" alone would silently miss history.
// Best-effort throughout: a directory that isn't readable (permissions, doesn't exist) just
// yields nothing from that user, never an error - same philosophy as every other collector.

func userProfileRoots() []string {
	if runtime.GOOS == "windows" {
		drive := os.Getenv("SystemDrive")
		if drive == "" {
			drive = "C:"
		}
		base := drive + `\Users`
		entries, err := os.ReadDir(base)
		if err != nil {
			return nil
		}
		skip := map[string]bool{"public": true, "default": true, "default user": true, "all users": true}
		var roots []string
		for _, e := range entries {
			if !e.IsDir() || skip[strings.ToLower(e.Name())] {
				continue
			}
			roots = append(roots, filepath.Join(base, e.Name()))
		}
		return roots
	}

	if runtime.GOOS == "darwin" {
		entries, err := os.ReadDir("/Users")
		if err != nil {
			return nil
		}
		// "Shared" is a real folder under /Users on every Mac, not a user account - same
		// exclusion spirit as Windows' Public/Default skip list above.
		var roots []string
		for _, e := range entries {
			if !e.IsDir() || strings.EqualFold(e.Name(), "shared") {
				continue
			}
			roots = append(roots, filepath.Join("/Users", e.Name()))
		}
		return roots
	}

	entries, err := os.ReadDir("/home")
	if err != nil {
		return nil
	}
	var roots []string
	for _, e := range entries {
		if e.IsDir() {
			roots = append(roots, filepath.Join("/home", e.Name()))
		}
	}
	return roots
}

func chromeUserDataDir(userDir string) string {
	switch runtime.GOOS {
	case "windows":
		return filepath.Join(userDir, "AppData", "Local", "Google", "Chrome", "User Data")
	case "darwin":
		return filepath.Join(userDir, "Library", "Application Support", "Google", "Chrome")
	default:
		return filepath.Join(userDir, ".config", "google-chrome")
	}
}

func edgeUserDataDir(userDir string) string {
	switch runtime.GOOS {
	case "windows":
		return filepath.Join(userDir, "AppData", "Local", "Microsoft", "Edge", "User Data")
	case "darwin":
		return filepath.Join(userDir, "Library", "Application Support", "Microsoft Edge")
	default:
		return filepath.Join(userDir, ".config", "microsoft-edge")
	}
}

func firefoxProfilesDir(userDir string) string {
	switch runtime.GOOS {
	case "windows":
		return filepath.Join(userDir, "AppData", "Roaming", "Mozilla", "Firefox", "Profiles")
	case "darwin":
		return filepath.Join(userDir, "Library", "Application Support", "Firefox", "Profiles")
	default:
		return filepath.Join(userDir, ".mozilla", "firefox")
	}
}

// safariHistoryFile is macOS-only - Safari isn't available on Windows/Linux, so unlike the
// three functions above this has no non-darwin branch; CollectBrowserHistory only calls it
// under a runtime.GOOS == "darwin" guard.
func safariHistoryFile(userDir string) string {
	return filepath.Join(userDir, "Library", "Safari", "History.db")
}

// chromiumProfileHistoryFiles covers both the default profile and any additional
// "Profile N" the user created - Chrome/Edge share this exact directory layout.
func chromiumProfileHistoryFiles(userDataDir string) []string {
	entries, err := os.ReadDir(userDataDir)
	if err != nil {
		return nil
	}
	var files []string
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		name := e.Name()
		if name != "Default" && !strings.HasPrefix(name, "Profile ") {
			continue
		}
		candidate := filepath.Join(userDataDir, name, "History")
		if _, err := os.Stat(candidate); err == nil {
			files = append(files, candidate)
		}
	}
	return files
}

// firefoxPlacesFiles covers every profile directory Firefox created (the random-looking
// prefix on each, e.g. "xxxxxxxx.default-release", isn't something worth pattern-matching -
// any directory containing a places.sqlite is a real profile).
func firefoxPlacesFiles(profilesDir string) []string {
	entries, err := os.ReadDir(profilesDir)
	if err != nil {
		return nil
	}
	var files []string
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		candidate := filepath.Join(profilesDir, e.Name(), "places.sqlite")
		if _, err := os.Stat(candidate); err == nil {
			files = append(files, candidate)
		}
	}
	return files
}

// --- Locked-file copy workaround ----------------------------------------------------------

// copySqliteForReadonly copies a browser's history DB (plus WAL/SHM sidecars, if present -
// absence is normal, either non-WAL mode or nothing pending) to a temp directory so it can
// be opened read-only without fighting the browser's own open handle on it. Standard
// technique, no special OS API - see the approved plan's collector section. The returned
// cleanup func removes the whole temp directory; always deferred by the caller.
func copySqliteForReadonly(dbPath string) (string, func(), error) {
	if _, err := os.Stat(dbPath); err != nil {
		return "", nil, err
	}
	tmpDir, err := os.MkdirTemp("", "logmonitor-browserhist-*")
	if err != nil {
		return "", nil, err
	}
	cleanup := func() { _ = os.RemoveAll(tmpDir) }

	dest := filepath.Join(tmpDir, "history.sqlite")
	if err := copyFileBestEffort(dbPath, dest); err != nil {
		cleanup()
		return "", nil, err
	}
	for _, suffix := range []string{"-wal", "-shm"} {
		_ = copyFileBestEffort(dbPath+suffix, dest+suffix)
	}
	return dest, cleanup, nil
}

func copyFileBestEffort(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, data, 0600)
}

// --- Domain extraction ---------------------------------------------------------------------

// bareDomainFromURL is the one place a full URL is ever parsed. Only Hostname() is read from
// the result - path, query string, and fragment (where form data, search terms, and session
// tokens would live) are discarded by construction and never touched again. This is what
// makes the "no full page content, no form contents, no search terms transmitted" guarantee
// in the approved plan's privacy section actually true, not just a stated intent.
func bareDomainFromURL(rawURL string) (string, bool) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return "", false
	}
	host := strings.ToLower(u.Hostname())
	if host == "" || !strings.Contains(host, ".") {
		return "", false
	}
	return host, true
}

// --- Per-source collection ------------------------------------------------------------------

// collectFromChromium reads one Chrome or Edge profile's History sqlite file. On the very
// first poll of a given profile (no cursor recorded yet), it seeds the cursor at the DB's
// current max visit_time and returns no events - mirrors runUsbPolling's seed-without-replay
// convention in run.go: never dump years of pre-monitoring browsing history the moment
// collection turns on for a device. Returns (visits, stateChanged).
func collectFromChromium(browser, historyPath, key string, state *browserActivityState) ([]rawVisit, bool) {
	tmpPath, cleanup, err := copySqliteForReadonly(historyPath)
	if err != nil {
		return nil, false
	}
	defer cleanup()

	db, err := sql.Open("sqlite", tmpPath+"?mode=ro")
	if err != nil {
		return nil, false
	}
	defer db.Close()

	cursor, known := state.Cursors[key]
	if !known {
		var maxTime sql.NullInt64
		_ = db.QueryRow(`SELECT MAX(visit_time) FROM visits`).Scan(&maxTime)
		state.Cursors[key] = maxTime.Int64
		return nil, true
	}

	rows, err := db.Query(`
		SELECT urls.url, urls.title, visits.visit_time
		FROM visits JOIN urls ON visits.url = urls.id
		WHERE visits.visit_time > ?
		ORDER BY visits.visit_time DESC
		LIMIT ?`, cursor, browserHistoryMaxRowsPerSource)
	if err != nil {
		return nil, false
	}
	defer rows.Close()

	var out []rawVisit
	newCursor := cursor
	for rows.Next() {
		var rawURL, title string
		var chromeTime int64
		if err := rows.Scan(&rawURL, &title, &chromeTime); err != nil {
			continue
		}
		if chromeTime > newCursor {
			newCursor = chromeTime
		}
		domain, ok := bareDomainFromURL(rawURL)
		if !ok {
			continue
		}
		out = append(out, rawVisit{
			Browser:   browser,
			Domain:    domain,
			Title:     title,
			VisitedAt: time.UnixMicro(chromeTime - chromeEpochDeltaMicro).UTC(),
		})
	}
	state.Cursors[key] = newCursor
	return out, true
}

// collectFromFirefox mirrors collectFromChromium exactly (same first-run seed behavior,
// same cursor persistence) against Firefox's places.sqlite schema. Firefox's visit_date is
// already microseconds since the Unix epoch - no epoch-delta conversion needed, unlike
// Chrome/Edge.
func collectFromFirefox(placesPath, key string, state *browserActivityState) ([]rawVisit, bool) {
	tmpPath, cleanup, err := copySqliteForReadonly(placesPath)
	if err != nil {
		return nil, false
	}
	defer cleanup()

	db, err := sql.Open("sqlite", tmpPath+"?mode=ro")
	if err != nil {
		return nil, false
	}
	defer db.Close()

	cursor, known := state.Cursors[key]
	if !known {
		var maxTime sql.NullInt64
		_ = db.QueryRow(`SELECT MAX(visit_date) FROM moz_historyvisits`).Scan(&maxTime)
		state.Cursors[key] = maxTime.Int64
		return nil, true
	}

	rows, err := db.Query(`
		SELECT moz_places.url, moz_places.title, moz_historyvisits.visit_date
		FROM moz_historyvisits JOIN moz_places ON moz_historyvisits.place_id = moz_places.id
		WHERE moz_historyvisits.visit_date > ?
		ORDER BY moz_historyvisits.visit_date DESC
		LIMIT ?`, cursor, browserHistoryMaxRowsPerSource)
	if err != nil {
		return nil, false
	}
	defer rows.Close()

	var out []rawVisit
	newCursor := cursor
	for rows.Next() {
		var rawURL string
		var title sql.NullString
		var visitDate int64
		if err := rows.Scan(&rawURL, &title, &visitDate); err != nil {
			continue
		}
		if visitDate > newCursor {
			newCursor = visitDate
		}
		domain, ok := bareDomainFromURL(rawURL)
		if !ok {
			continue
		}
		out = append(out, rawVisit{
			Browser:   "firefox",
			Domain:    domain,
			Title:     title.String,
			VisitedAt: time.UnixMicro(visitDate).UTC(),
		})
	}
	state.Cursors[key] = newCursor
	return out, true
}

// collectFromSafari mirrors collectFromChromium/collectFromFirefox exactly (same first-run
// seed behavior, same cursor persistence) against Safari's History.db schema: history_visits
// (visit_time, title, history_item) joined to history_items (url) - a genuinely different
// schema from both Chromium's and Firefox's, not just a different epoch. visit_time is
// fractional seconds (a REAL column) since the Mac absolute time epoch (2001-01-01), so it's
// truncated to whole seconds before conversion - sub-second precision isn't meaningful for
// this feature's dwell-time granularity anyway.
func collectFromSafari(historyPath, key string, state *browserActivityState) ([]rawVisit, bool) {
	tmpPath, cleanup, err := copySqliteForReadonly(historyPath)
	if err != nil {
		return nil, false
	}
	defer cleanup()

	db, err := sql.Open("sqlite", tmpPath+"?mode=ro")
	if err != nil {
		return nil, false
	}
	defer db.Close()

	cursor, known := state.Cursors[key]
	if !known {
		var maxTime sql.NullFloat64
		_ = db.QueryRow(`SELECT MAX(visit_time) FROM history_visits`).Scan(&maxTime)
		state.Cursors[key] = int64(maxTime.Float64)
		return nil, true
	}

	rows, err := db.Query(`
		SELECT history_items.url, history_visits.title, history_visits.visit_time
		FROM history_visits JOIN history_items ON history_visits.history_item = history_items.id
		WHERE history_visits.visit_time > ?
		ORDER BY history_visits.visit_time DESC
		LIMIT ?`, cursor, browserHistoryMaxRowsPerSource)
	if err != nil {
		return nil, false
	}
	defer rows.Close()

	var out []rawVisit
	newCursor := cursor
	for rows.Next() {
		var rawURL string
		var title sql.NullString
		var visitTime float64
		if err := rows.Scan(&rawURL, &title, &visitTime); err != nil {
			continue
		}
		visitTimeInt := int64(visitTime)
		if visitTimeInt > newCursor {
			newCursor = visitTimeInt
		}
		domain, ok := bareDomainFromURL(rawURL)
		if !ok {
			continue
		}
		out = append(out, rawVisit{
			Browser:   "safari",
			Domain:    domain,
			Title:     title.String,
			VisitedAt: time.Unix(visitTimeInt+safariEpochDeltaSeconds, 0).UTC(),
		})
	}
	state.Cursors[key] = newCursor
	return out, true
}

// --- Exclusion filter + dwell computation + batch assembly ---------------------------------

// isDomainExcluded is the agent-side primary enforcement point for sensitive-domain
// exclusion (medical/banking/legal/union, etc.) - an excluded visit is dropped here, before
// it's ever added to the outbound batch, which is the only way to guarantee it never touches
// the network. The server's ingest route re-checks independently (defense-in-depth against a
// stale list), but that is not this function's job. Boundary-aware suffix match, identical
// logic to src/lib/browserActivity/excludedDomainsFilter.ts's isDomainExcluded: "example-
// bank.com.evil.com" must never match an excluded "example-bank.com".
func isDomainExcluded(domain string, excludedSuffixes []string) bool {
	for _, excluded := range excludedSuffixes {
		excluded = strings.ToLower(strings.TrimSpace(excluded))
		if excluded == "" {
			continue
		}
		if domain == excluded || strings.HasSuffix(domain, "."+excluded) {
			return true
		}
	}
	return false
}

type visitWithDwell struct {
	visit rawVisit
	dwell *int
}

// buildPayload filters excluded domains, computes a dwell estimate per domain-chronological
// sequence (identical algorithm to dwellTime.ts's computeDwellSeconds - capped delta to the
// next same-domain visit, nil for whichever visit is most recent in its sequence), and caps
// the final batch size, logging when a cap actually drops something rather than doing so
// silently.
func buildPayload(visits []rawVisit, excludedSuffixes []string) []browserActivityEventPayload {
	filtered := make([]rawVisit, 0, len(visits))
	for _, v := range visits {
		if !isDomainExcluded(v.Domain, excludedSuffixes) {
			filtered = append(filtered, v)
		}
	}

	withDwell := make([]visitWithDwell, len(filtered))
	for i, v := range filtered {
		withDwell[i] = visitWithDwell{visit: v}
	}

	byDomain := map[string][]int{}
	for i, v := range filtered {
		byDomain[v.Domain] = append(byDomain[v.Domain], i)
	}
	for _, idxs := range byDomain {
		sort.Slice(idxs, func(a, b int) bool {
			return filtered[idxs[a]].VisitedAt.Before(filtered[idxs[b]].VisitedAt)
		})
		for i := 0; i < len(idxs)-1; i++ {
			delta := filtered[idxs[i+1]].VisitedAt.Sub(filtered[idxs[i]].VisitedAt)
			deltaSeconds := int(delta.Round(time.Second) / time.Second)
			if deltaSeconds < 0 {
				deltaSeconds = 0
			}
			if deltaSeconds > browserHistoryDwellCapSeconds {
				deltaSeconds = browserHistoryDwellCapSeconds
			}
			d := deltaSeconds
			withDwell[idxs[i]].dwell = &d
		}
		// The most recent visit in this domain's sequence has no next timestamp to bound
		// it - stays nil, same as dwellTime.ts.
	}

	sort.Slice(withDwell, func(a, b int) bool {
		return withDwell[a].visit.VisitedAt.After(withDwell[b].visit.VisitedAt)
	})

	if len(withDwell) > browserHistoryMaxEventsPerBatch {
		log.Printf("browser activity: %d events collected this poll, capping upload to the %d most recent", len(withDwell), browserHistoryMaxEventsPerBatch)
		withDwell = withDwell[:browserHistoryMaxEventsPerBatch]
	}

	out := make([]browserActivityEventPayload, 0, len(withDwell))
	for _, vd := range withDwell {
		var titlePtr *string
		if vd.visit.Title != "" {
			t := vd.visit.Title
			titlePtr = &t
		}
		out = append(out, browserActivityEventPayload{
			Browser:      vd.visit.Browser,
			Domain:       vd.visit.Domain,
			PageTitle:    titlePtr,
			VisitedAt:    vd.visit.VisitedAt.Format(time.RFC3339),
			DwellSeconds: vd.dwell,
		})
	}
	return out
}

// CollectBrowserHistory is the single entry point called from run.go's heartbeat loop. Walks
// every local user profile discovered on this device, reads whatever's new since each
// browser profile's own persisted cursor, filters and computes dwell, and returns the batch
// ready to POST. excludedSuffixes comes straight from the heartbeat response (see
// HeartbeatResponse.ExcludedDomainSuffixes in client.go) - always the latest list the server
// has, never cached longer than one heartbeat interval.
func CollectBrowserHistory(excludedSuffixes []string) []browserActivityEventPayload {
	state := loadBrowserActivityState()
	stateChanged := false
	var visits []rawVisit

	for _, userDir := range userProfileRoots() {
		username := filepath.Base(userDir)

		for _, historyPath := range chromiumProfileHistoryFiles(chromeUserDataDir(userDir)) {
			v, changed := collectFromChromium("chrome", historyPath, cursorKey(username, "chrome", historyPath), state)
			visits = append(visits, v...)
			stateChanged = stateChanged || changed
		}
		for _, historyPath := range chromiumProfileHistoryFiles(edgeUserDataDir(userDir)) {
			v, changed := collectFromChromium("edge", historyPath, cursorKey(username, "edge", historyPath), state)
			visits = append(visits, v...)
			stateChanged = stateChanged || changed
		}
		for _, placesPath := range firefoxPlacesFiles(firefoxProfilesDir(userDir)) {
			v, changed := collectFromFirefox(placesPath, cursorKey(username, "firefox", placesPath), state)
			visits = append(visits, v...)
			stateChanged = stateChanged || changed
		}
		if runtime.GOOS == "darwin" {
			safariPath := safariHistoryFile(userDir)
			if _, err := os.Stat(safariPath); err == nil {
				v, changed := collectFromSafari(safariPath, cursorKey(username, "safari", safariPath), state)
				visits = append(visits, v...)
				stateChanged = stateChanged || changed
			}
		}
	}

	if stateChanged {
		saveBrowserActivityState(state)
	}

	return buildPayload(visits, excludedSuffixes)
}
