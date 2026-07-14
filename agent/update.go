package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

const updateRepo = "bibek-n/logmonitor"

// How long a freshly-applied update gets to prove itself (via a successful heartbeat)
// before EvaluatePendingUpdate gives up and rolls back to the previous binary.
const updateConfirmWindow = 3 * time.Minute

type githubRelease struct {
	TagName string `json:"tag_name"`
	Assets  []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
	} `json:"assets"`
}

type UpdateMarker struct {
	OldBinaryPath string    `json:"oldBinaryPath"`
	NewVersion    string    `json:"newVersion"`
	StartedAt     time.Time `json:"startedAt"`
}

func markerPath() string {
	return filepath.Join(filepath.Dir(ConfigPath()), "update-pending.json")
}

func writeMarker(m UpdateMarker) error {
	data, err := json.Marshal(m)
	if err != nil {
		return err
	}
	return os.WriteFile(markerPath(), data, 0600)
}

func readMarker() *UpdateMarker {
	data, err := os.ReadFile(markerPath())
	if err != nil {
		return nil
	}
	var m UpdateMarker
	if err := json.Unmarshal(data, &m); err != nil {
		return nil
	}
	return &m
}

func clearMarker() {
	_ = os.Remove(markerPath())
}

// parseVersion pulls the numeric major/minor/patch triple out of tags like
// "agent-v0.7.0" (any non-digit prefix is tolerated). Returns ok=false if it
// doesn't look like a semver tag, so callers can fall back to a safe default
// instead of comparing garbage.
func parseVersion(tag string) (major, minor, patch int, ok bool) {
	v := tag
	if i := strings.LastIndex(v, "v"); i >= 0 {
		v = v[i+1:]
	}
	parts := strings.SplitN(v, ".", 3)
	if len(parts) != 3 {
		return 0, 0, 0, false
	}
	nums := make([]int, 3)
	for i, p := range parts {
		n, err := strconv.Atoi(strings.TrimSpace(p))
		if err != nil {
			return 0, 0, 0, false
		}
		nums[i] = n
	}
	return nums[0], nums[1], nums[2], true
}

// isNewerVersion reports whether remote is a strictly greater semver than
// local. If either tag doesn't parse as semver, it falls back to a simple
// inequality check (preserves old behavior for non-standard tags) rather
// than refusing to ever update.
func isNewerVersion(local, remote string) bool {
	lMaj, lMin, lPatch, lOk := parseVersion(local)
	rMaj, rMin, rPatch, rOk := parseVersion(remote)
	if !lOk || !rOk {
		return remote != local
	}
	if rMaj != lMaj {
		return rMaj > lMaj
	}
	if rMin != lMin {
		return rMin > lMin
	}
	return rPatch > lPatch
}

func platformAssetName() string {
	switch runtime.GOOS {
	case "windows":
		return "agent.exe"
	case "linux":
		if runtime.GOARCH == "arm64" {
			return "logmonitor-agent-linux-arm64"
		}
		return "logmonitor-agent-linux-amd64"
	default:
		return ""
	}
}

func fetchLatestRelease() (*githubRelease, error) {
	client := http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(fmt.Sprintf("https://api.github.com/repos/%s/releases/latest", updateRepo))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d", resp.StatusCode)
	}
	var rel githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&rel); err != nil {
		return nil, err
	}
	return &rel, nil
}

func downloadBytes(url string) ([]byte, error) {
	client := http.Client{Timeout: 60 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download failed: HTTP %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

func verifyChecksum(assetName string, assetBytes []byte, checksumsText string) error {
	sum := sha256.Sum256(assetBytes)
	got := hex.EncodeToString(sum[:])
	for _, line := range strings.Split(checksumsText, "\n") {
		fields := strings.Fields(line)
		if len(fields) == 2 && strings.TrimPrefix(fields[1], "*") == assetName {
			if fields[0] != got {
				return fmt.Errorf("checksum mismatch for %s: expected %s, got %s", assetName, fields[0], got)
			}
			return nil
		}
	}
	return fmt.Errorf("no checksum entry found for %s", assetName)
}

// CheckForUpdate compares the running version against the latest GitHub release tag. If
// newer, it downloads + verifies the matching binary, swaps it into place (relying on
// the same rename-a-running-executable behavior most Go self-updaters use — this works
// on Windows because NTFS allows renaming an open file's directory entry even while its
// data is mapped by the running process, and on Linux because the process keeps running
// against the renamed inode), writes a pending-update marker, and exits non-zero so the
// service supervisor (Windows SCM / systemd Restart=on-failure) relaunches the new
// binary. Never partially "applies" on error — any failure just leaves the old binary
// running untouched.
func CheckForUpdate(currentVersion string) {
	assetName := platformAssetName()
	if assetName == "" {
		return
	}

	rel, err := fetchLatestRelease()
	if err != nil {
		log.Printf("update check failed: %v", err)
		return
	}
	if rel.TagName == "" || !isNewerVersion(currentVersion, rel.TagName) {
		return // already current, or remote isn't actually newer (never downgrade)
	}

	var assetURL, checksumsURL string
	for _, a := range rel.Assets {
		if a.Name == assetName {
			assetURL = a.BrowserDownloadURL
		}
		if a.Name == "checksums.txt" {
			checksumsURL = a.BrowserDownloadURL
		}
	}
	if assetURL == "" || checksumsURL == "" {
		log.Printf("update %s available but assets incomplete — skipping", rel.TagName)
		return
	}

	assetBytes, err := downloadBytes(assetURL)
	if err != nil {
		log.Printf("update download failed: %v", err)
		return
	}
	checksumsBytes, err := downloadBytes(checksumsURL)
	if err != nil {
		log.Printf("checksum download failed: %v", err)
		return
	}
	if err := verifyChecksum(assetName, assetBytes, string(checksumsBytes)); err != nil {
		log.Printf("update verification failed, aborting: %v", err)
		return
	}

	exePath, err := os.Executable()
	if err != nil {
		log.Printf("could not determine own executable path: %v", err)
		return
	}
	newPath := exePath + ".new"
	oldPath := exePath + ".old"

	if err := os.WriteFile(newPath, assetBytes, 0755); err != nil {
		log.Printf("failed to write new binary: %v", err)
		return
	}
	if err := os.Rename(exePath, oldPath); err != nil {
		log.Printf("failed to back up current binary: %v", err)
		_ = os.Remove(newPath)
		return
	}
	if err := os.Rename(newPath, exePath); err != nil {
		log.Printf("failed to install new binary, restoring previous: %v", err)
		_ = os.Rename(oldPath, exePath) // best-effort restore
		return
	}

	if err := writeMarker(UpdateMarker{OldBinaryPath: oldPath, NewVersion: rel.TagName, StartedAt: time.Now()}); err != nil {
		log.Printf("failed to write update marker (continuing anyway): %v", err)
	}

	log.Printf("updated %s -> %s, restarting", currentVersion, rel.TagName)
	os.Exit(1) // non-zero so the service supervisor relaunches us
}

// EvaluatePendingUpdate is called once per heartbeat tick in run.go. If we booted with a
// pending-update marker (i.e. this process is a freshly-updated binary), a successful
// heartbeat commits the update (old binary + marker removed); repeated failure across
// updateConfirmWindow rolls back to the previous binary and restarts again.
func EvaluatePendingUpdate(heartbeatOK bool) {
	marker := readMarker()
	if marker == nil {
		return
	}

	if heartbeatOK {
		log.Printf("update to %s confirmed, cleaning up previous version", marker.NewVersion)
		_ = os.Remove(marker.OldBinaryPath)
		clearMarker()
		return
	}

	if time.Since(marker.StartedAt) < updateConfirmWindow {
		return // give it more time — could just be a transient network blip
	}

	log.Printf("update to %s failed to confirm within %s, rolling back", marker.NewVersion, updateConfirmWindow)
	exePath, err := os.Executable()
	if err != nil {
		return
	}
	if err := os.Rename(marker.OldBinaryPath, exePath); err != nil {
		log.Printf("rollback failed: %v", err)
		return
	}
	clearMarker()
	os.Exit(1) // let the supervisor relaunch the restored previous binary
}
