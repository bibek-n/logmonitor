package main

import (
	"fmt"
	"os"
	"runtime"
	"time"

	"github.com/tadvi/systray"
)

// Real tray icon on Windows via tadvi/systray (already an indirect dependency of the main
// agent through beeep, so this adds no new dependency). Win32 message loops are
// thread-affine, so this must own the OS thread it runs on.
func runTray(cfg *chatConfig) {
	runtime.LockOSThread()

	tray, err := systray.New()
	if err != nil {
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
		return
	}

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
			if nresp, err := pollNotifications(cfg); err == nil && nresp.OK {
				for _, n := range nresp.Notifications {
					_ = tray.ShowMessage("Notification from Admin", n.Message, false)
				}
			}
			time.Sleep(pollInterval)
		}
	}()

	_ = tray.Run()
}
