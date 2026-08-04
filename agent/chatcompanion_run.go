// The chat companion mode ("agent tray"): the main agent runs as a Windows Service / Linux
// systemd system unit — neither has access to the logged-in user's desktop session, so neither
// can show a tray icon or a clickable notification. This mode instead runs IN that session
// (autostarted at login, same binary invoked with the "tray" subcommand instead of "run" - see
// installChatCompanion/uninstallChatCompanion) and does exactly one thing: poll for unread chat
// messages/admin notifications and let the employee open the chat. It authenticates with the
// low-privilege ChatToken (see ChatConfig in config.go), never the device's full API key - the
// autostart entry only ever needs to hold this one narrow-scope credential.
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

const pollInterval = 20 * time.Second

func chatPageURL(cfg *ChatConfig) string {
	return fmt.Sprintf("%s/chat/%s?token=%s", cfg.ServerURL, url.PathEscape(cfg.DeviceID), url.QueryEscape(cfg.ChatToken))
}

type unreadResponse struct {
	OK            bool `json:"ok"`
	ChatAvailable bool `json:"chatAvailable"`
	UnreadCount   int  `json:"unreadCount"`
}

var httpClient = &http.Client{Timeout: 10 * time.Second}

func pollUnread(cfg *ChatConfig) (*unreadResponse, error) {
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

func pollNotifications(cfg *ChatConfig) (*notificationsResponse, error) {
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

// runChatCompanion is the entry point for "agent tray" (formerly the separate chattray.exe/
// logmonitor-chattray binary - see cmd dispatch in main.go). Never returns.
func runChatCompanion() {
	cfg, err := LoadChatConfig()
	if err != nil {
		// Not enrolled yet, or chat wasn't set up for this device — exit quietly. The
		// autostart entry just tries again next login; this is a bonus feature and should
		// never surface an error to the user.
		os.Exit(0)
	}
	if !hasDesktopSession() {
		os.Exit(0)
	}
	// Now that the service can also launch this via a Scheduled Task on its own (see
	// ensureChatCompanionAutostart), on top of the original per-user Registry Run key, more
	// than one autostart path can fire for the same session - this makes double-launching
	// harmless instead of showing two tray icons.
	if !acquireTraySingleInstanceLock() {
		os.Exit(0)
	}
	go runRemoteSupportPoll(cfg)
	runTray(cfg)
}
