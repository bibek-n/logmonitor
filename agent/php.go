package main

import (
	"bufio"
	"io"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"time"
)

// PHP version discovery, mirroring linuxsecurity.go's philosophy: best-effort, Linux-only,
// slow-changing so a long poll interval is fine (installed PHP versions rarely change between
// deploys). Debian/Ubuntu's php-fpm/php-cli packages (including the widely-used ondrej/php PPA
// that most multi-version boxes rely on) lay every installed version out under
// /etc/php/<X.Y>/{cli,fpm}/ regardless of which SAPIs are actually installed for it - that
// directory listing alone is a more reliable source of truth than parsing `php -v`/binary
// names, and it's the only approach that naturally covers side-by-side versions.
const phpPollInterval = 15 * time.Minute
const phpLogTailMaxBytes = 256 * 1024 // last 256KB - enough context for a real error without shipping a multi-GB log

func PhpDetected() bool {
	return runtime.GOOS == "linux"
}

type PhpVersionInfo struct {
	Version         string `json:"version"`
	SapiCli         bool   `json:"sapiCli"`
	SapiFpm         bool   `json:"sapiFpm"`
	CliErrorLogPath string `json:"cliErrorLogPath"`
	FpmErrorLogPath string `json:"fpmErrorLogPath"`
	IsDefault       bool   `json:"isDefault"`
}

// PhpStatus is the full payload posted to /api/agent/php-status.
type PhpStatus struct {
	Detected bool             `json:"detected"`
	Versions []PhpVersionInfo `json:"versions"`
}

var phpVersionDirRe = regexp.MustCompile(`^\d+\.\d+$`)

// discoverPhpVersions lists /etc/php/*, keeping only entries that look like a version number
// (skips things like /etc/php/mods-available which exists on some layouts).
func discoverPhpVersions() []string {
	entries, err := os.ReadDir("/etc/php")
	if err != nil {
		return nil
	}
	var versions []string
	for _, e := range entries {
		if e.IsDir() && phpVersionDirRe.MatchString(e.Name()) {
			versions = append(versions, e.Name())
		}
	}
	sort.Strings(versions)
	return versions
}

// defaultPhpVersion resolves whichever version `php` on PATH currently resolves to (the
// update-alternatives-selected default), via `php -v`'s first line ("PHP 8.1.2 (cli) ...").
var phpVersionLineRe = regexp.MustCompile(`^PHP (\d+\.\d+)`)

func defaultPhpVersion() string {
	out := runShell(linuxSecurityTimeout, "php -v 2>/dev/null | head -n 1")
	m := phpVersionLineRe.FindStringSubmatch(out)
	if m == nil {
		return ""
	}
	return m[1]
}

var iniErrorLogRe = regexp.MustCompile(`(?m)^\s*error_log\s*=\s*"?([^";\s][^";]*)"?\s*(;.*)?$`)

// readIniErrorLog greps a single `error_log = ...` directive out of a php.ini-style file - not
// a full INI parser (overkill here), just the one directive this feature actually needs. An
// unset or explicitly blank error_log (common for CLI, which many setups leave logging to
// stderr rather than a file) correctly yields "".
func readIniErrorLog(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	m := iniErrorLogRe.FindStringSubmatch(string(data))
	if m == nil {
		return ""
	}
	return strings.TrimSpace(m[1])
}

var poolErrorLogRe = regexp.MustCompile(`(?m)^\s*(php_admin_value\[error_log\]|error_log)\s*=\s*"?([^";\s][^";]*)"?\s*(;.*)?$`)

// fpmErrorLogFor prefers a pool-level override (php_admin_value[error_log] in pool.d/*.conf -
// the common way a site-specific FPM pool redirects its own errors) over the FPM master
// process's own `error_log` directive in php-fpm.conf, falling back to the well-known Debian
// packaging default path if neither is explicitly set. Simplification: if multiple pools exist
// with different overrides, this just takes the first one found - granular per-pool log
// selection is more than this feature's "pick a version, see its errors" scope needs.
func fpmErrorLogFor(version string) string {
	poolDir := filepath.Join("/etc/php", version, "fpm/pool.d")
	if entries, err := os.ReadDir(poolDir); err == nil {
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".conf") {
				continue
			}
			data, err := os.ReadFile(filepath.Join(poolDir, e.Name()))
			if err != nil {
				continue
			}
			if m := poolErrorLogRe.FindStringSubmatch(string(data)); m != nil {
				return strings.TrimSpace(m[2])
			}
		}
	}

	masterConf := filepath.Join("/etc/php", version, "fpm/php-fpm.conf")
	if data, err := os.ReadFile(masterConf); err == nil {
		if m := poolErrorLogRe.FindStringSubmatch(string(data)); m != nil {
			return strings.TrimSpace(m[2])
		}
	}

	return "/var/log/php" + version + "-fpm.log"
}

// CollectPhpStatus is best-effort, same philosophy as linuxsecurity.go - a version directory
// with only a cli/ or only an fpm/ subtree just reports the other SAPI as false rather than
// failing the whole pass.
func CollectPhpStatus() PhpStatus {
	if !PhpDetected() {
		return PhpStatus{Detected: false}
	}

	defaultVersion := defaultPhpVersion()
	var versions []PhpVersionInfo
	for _, v := range discoverPhpVersions() {
		cliIni := filepath.Join("/etc/php", v, "cli/php.ini")
		fpmIni := filepath.Join("/etc/php", v, "fpm/php.ini")

		info := PhpVersionInfo{
			Version:   v,
			IsDefault: v == defaultVersion,
		}
		if _, err := os.Stat(cliIni); err == nil {
			info.SapiCli = true
			info.CliErrorLogPath = readIniErrorLog(cliIni)
		}
		if _, err := os.Stat(fpmIni); err == nil {
			info.SapiFpm = true
			info.FpmErrorLogPath = fpmErrorLogFor(v)
		}
		if info.SapiCli || info.SapiFpm {
			versions = append(versions, info)
		}
	}

	return PhpStatus{Detected: true, Versions: versions}
}

// readLogTail is a one-shot read of the last phpLogTailMaxBytes of a file - deliberately NOT
// the incremental offset-tracking tailer in logs.go, which is built for continuously shipping
// small increments and advances persistent state unsuited to "show me this log right now,
// on demand, possibly re-reading the same tail repeatedly."
func readLogTail(path string, maxBytes int64) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return "", err
	}

	var start int64
	if info.Size() > maxBytes {
		start = info.Size() - maxBytes
	}
	if _, err := f.Seek(start, io.SeekStart); err != nil {
		return "", err
	}

	reader := bufio.NewReader(f)
	if start > 0 {
		// Discard the first partial line so the tail starts cleanly at a line boundary.
		_, _ = reader.ReadString('\n')
	}
	data, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// PhpLogRequest mirrors one entry of the heartbeat response's pendingPhpLogRequests array -
// unlike malware-scan's plain boolean flag, this on-demand request is parameterized (which
// version, which SAPI), so the agent needs to know exactly which log to read.
type PhpLogRequest struct {
	ID      int    `json:"id"`
	Version string `json:"version"`
	Sapi    string `json:"sapi"`
}

type phpLogContentPayload struct {
	RequestID int    `json:"requestId"`
	Version   string `json:"version"`
	Sapi      string `json:"sapi"`
	Content   string `json:"content"`
	Error     string `json:"error,omitempty"`
}

// fetchOnePhpLog resolves the request's log path from a freshly collected PhpStatus (rather
// than trusting stale server-side data) and reads its tail - errors (log path unknown, file
// missing/unreadable) are reported back as a message in the Error field rather than silently
// dropping the request, so the admin console can show why nothing came back instead of hanging
// forever waiting for a response that will never arrive.
func fetchOnePhpLog(req PhpLogRequest, status PhpStatus) phpLogContentPayload {
	out := phpLogContentPayload{RequestID: req.ID, Version: req.Version, Sapi: req.Sapi}

	var logPath string
	for _, v := range status.Versions {
		if v.Version != req.Version {
			continue
		}
		if req.Sapi == "fpm" {
			logPath = v.FpmErrorLogPath
		} else {
			logPath = v.CliErrorLogPath
		}
	}
	if logPath == "" {
		out.Error = "No error log path configured for this PHP version/SAPI"
		return out
	}

	content, err := readLogTail(logPath, phpLogTailMaxBytes)
	if err != nil {
		out.Error = "Could not read " + logPath + ": " + err.Error()
		return out
	}
	out.Content = content
	return out
}

// handlePendingPhpLogRequests runs in its own goroutine (called from run.go's heartbeat loop,
// same non-blocking reasoning as triggerMalwareScanNow) - reading a log tail is fast, but
// there's no reason to risk delaying the next heartbeat on file I/O.
func handlePendingPhpLogRequests(client *Client, requests []PhpLogRequest) {
	if len(requests) == 0 {
		return
	}
	status := CollectPhpStatus()
	for _, req := range requests {
		payload := fetchOnePhpLog(req, status)
		if err := client.PostPhpLogContent(payload); err != nil {
			log.Printf("php log content upload failed (request %d): %v", req.ID, err)
		}
	}
}

func runPhpPolling(client *Client, stop <-chan struct{}) {
	ticker := time.NewTicker(phpPollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			if PhpDetected() {
				if err := client.PostPhpStatus(CollectPhpStatus()); err != nil {
					log.Printf("php status upload failed: %v", err)
				}
			}
		}
	}
}
