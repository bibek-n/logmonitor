package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"time"

	"github.com/tadvi/systray"
)

// TEMPORARY diagnostic aid for the USB-block-notification pilot - same reasoning as the main
// agent's debugLogUsbPolicy: this process has no console either, so trace to a file instead.
// Remove once toast delivery is confirmed working.
func debugLog(format string, args ...interface{}) {
	dir := os.Getenv("ProgramData")
	if dir == "" {
		dir = `C:\ProgramData`
	}
	dir = filepath.Join(dir, "LogMonitorAgent")
	_ = os.MkdirAll(dir, 0o755)
	f, err := os.OpenFile(filepath.Join(dir, "chat-tray-debug.log"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintf(f, "%s "+format+"\n", append([]interface{}{time.Now().Format(time.RFC3339)}, args...)...)
}

// Real tray icon on Windows via tadvi/systray (already an indirect dependency of the main
// agent through beeep, so this adds no new dependency). Win32 message loops are
// thread-affine, so this must own the OS thread it runs on.
func runTray(cfg *ChatConfig) {
	runtime.LockOSThread()

	debugLog("runTray starting")
	tray, err := systray.New()
	if err != nil {
		debugLog("systray.New failed: %v", err)
		return
	}

	openChat := func() { openBrowser(chatPageURL(cfg)) }

	tray.AppendMenu("Open Chat", openChat)
	tray.AppendSeparator()
	tray.AppendMenu("Exit", func() {
		tray.Stop()
		os.Exit(0)
	})
	tray.OnClick(openChat)

	// Resource ID 1 - the icon embedded via rsrc_windows.syso (generated from chat-icon.ico
	// with `rsrc -ico chat-icon.ico -o rsrc_windows.syso`, linked in automatically by the Go
	// build - see chat-icon.ico's neighboring rsrc_windows.syso). rsrc assigns the first (and
	// here, only) icon group resource ID 1 when no manifest resource precedes it.
	if err := tray.Show(1, "LogMonitor Chat"); err != nil {
		debugLog("tray.Show failed: %v", err)
		return
	}
	debugLog("tray.Show succeeded, entering poll loop")

	go func() {
		lastUnread := 0
		for {
			resp, err := pollUnread(cfg)
			if err == nil && resp.OK && resp.ChatAvailable {
				if resp.UnreadCount > 0 {
					_ = tray.SetTooltip(fmt.Sprintf("LogMonitor Chat — %d new message(s)", resp.UnreadCount))
					if resp.UnreadCount > lastUnread {
						_ = tray.ShowMessage("New message from IT Support", "Click the tray icon to open the chat.", false)
					}
				} else {
					_ = tray.SetTooltip("LogMonitor Chat")
				}
				lastUnread = resp.UnreadCount
			}
			nresp, err := pollNotifications(cfg)
			if err != nil {
				debugLog("pollNotifications error: %v", err)
			} else if !nresp.OK {
				debugLog("pollNotifications returned ok=false")
			} else if len(nresp.Notifications) > 0 {
				debugLog("pollNotifications returned %d notification(s)", len(nresp.Notifications))
				for _, n := range nresp.Notifications {
					showErr := tray.ShowMessage("Notification from Admin", n.Message, false)
					debugLog("ShowMessage(%q) returned err=%v", n.Message, showErr)
				}
			}
			time.Sleep(pollInterval)
		}
	}()

	_ = tray.Run()
}
