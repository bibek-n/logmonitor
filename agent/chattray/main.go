// Command chattray is a small, separate companion to the main LogMonitor agent. The main
// agent runs as a Windows Service / Linux systemd system unit — neither has access to the
// logged-in user's desktop session, so neither can show a tray icon or a clickable
// notification. This binary instead runs IN that session (autostarted at login) and does
// exactly one thing: poll for unread chat messages and let the employee open the chat.
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"
)

// Duplicated (deliberately) from the main agent's Config/ChatConfig in ../config.go: this
// binary is a separate `package main` (Go doesn't allow importing another package literally
// named "main"), and the schema here is small and stable, so a light duplication is simpler
// and lower-risk than restructuring the main agent's package layout just to share ~10 lines.
type chatConfig struct {
	ServerURL string `json:"serverUrl"`
	DeviceID  string `json:"deviceId"`
	ChatToken string `json:"chatToken"`
}

func chatConfigPath() string {
	if runtime.GOOS == "windows" {
		root := os.Getenv("ProgramData")
		if root == "" {
			root = `C:\ProgramData`
		}
		return filepath.Join(root, "LogMonitorAgent", "chat-config.json")
	}
	return "/etc/logmonitor-agent/chat-config.json"
}

func loadChatConfig() (*chatConfig, error) {
	data, err := os.ReadFile(chatConfigPath())
	if err != nil {
		return nil, err
	}
	var cfg chatConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	if cfg.ServerURL == "" || cfg.DeviceID == "" || cfg.ChatToken == "" {
		return nil, fmt.Errorf("chat config incomplete")
	}
	return &cfg, nil
}

const pollInterval = 20 * time.Second

func chatPageURL(cfg *chatConfig) string {
	return fmt.Sprintf("%s/chat/%s?token=%s", cfg.ServerURL, url.PathEscape(cfg.DeviceID), url.QueryEscape(cfg.ChatToken))
}

type unreadResponse struct {
	OK            bool `json:"ok"`
	ChatAvailable bool `json:"chatAvailable"`
	UnreadCount   int  `json:"unreadCount"`
}

var httpClient = &http.Client{Timeout: 10 * time.Second}

func pollUnread(cfg *chatConfig) (*unreadResponse, error) {
	u := fmt.Sprintf("%s/api/agent/chat-unread?deviceId=%s&token=%s", cfg.ServerURL, url.QueryEscape(cfg.DeviceID), url.QueryEscape(cfg.ChatToken))
	resp, err := httpClient.Get(u)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var out unreadResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	return &out, nil
}

// A one-off admin broadcast/direct message — distinct from chat: the server advances a
// per-device watermark once these are returned (see /api/agent/notifications), so each one
// is shown exactly once rather than persisting as an "unread count" the way chat does.
type adminNotification struct {
	ID      int    `json:"id"`
	Message string `json:"message"`
}

type notificationsResponse struct {
	OK            bool                `json:"ok"`
	Notifications []adminNotification `json:"notifications"`
}

func pollNotifications(cfg *chatConfig) (*notificationsResponse, error) {
	u := fmt.Sprintf("%s/api/agent/notifications?deviceId=%s&token=%s", cfg.ServerURL, url.QueryEscape(cfg.DeviceID), url.QueryEscape(cfg.ChatToken))
	resp, err := httpClient.Get(u)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var out notificationsResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	return &out, nil
}

// chromiumAppModePaths lists where a Chromium-based browser is commonly installed, checked
// in order - Edge first since it ships with Windows 10/11 by default, Chrome as the most
// likely alternative. "--app=" mode renders the page in its own window with no address bar,
// tabs, or bookmarks - the closest thing to a native desktop chat window without embedding
// a whole browser engine into this binary (which would need something like WebView2, itself
// unavailable on the Windows 7 machines this agent also has to support).
func chromiumAppModePaths() []string {
	var paths []string
	programFiles := []string{os.Getenv("ProgramFiles"), os.Getenv("ProgramFiles(x86)")}
	for _, pf := range programFiles {
		if pf == "" {
			continue
		}
		paths = append(paths,
			filepath.Join(pf, "Microsoft", "Edge", "Application", "msedge.exe"),
			filepath.Join(pf, "Google", "Chrome", "Application", "chrome.exe"),
		)
	}
	if localAppData := os.Getenv("LOCALAPPDATA"); localAppData != "" {
		paths = append(paths, filepath.Join(localAppData, "Google", "Chrome", "Application", "chrome.exe"))
	}
	return paths
}

func openBrowser(target string) {
	if runtime.GOOS == "windows" {
		for _, browserPath := range chromiumAppModePaths() {
			if _, err := os.Stat(browserPath); err != nil {
				continue
			}
			cmd := exec.Command(browserPath, "--app="+target, "--window-size=420,640")
			if cmd.Start() == nil {
				return
			}
		}
		// No Chromium-based browser found (or it failed to launch) - fall back to whatever
		// the default browser is, in a normal tabbed window, rather than not opening at all.
		_ = exec.Command("cmd", "/c", "start", "", target).Start()
		return
	}
	_ = exec.Command("xdg-open", target).Start()
}

func main() {
	cfg, err := loadChatConfig()
	if err != nil {
		// Not enrolled yet, or chat wasn't set up for this device — exit quietly. The
		// autostart entry just tries again next login; this is a bonus feature and should
		// never surface an error to the user.
		os.Exit(0)
	}
	if !hasDesktopSession() {
		os.Exit(0)
	}
	runTray(cfg)
}
