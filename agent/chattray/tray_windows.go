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

	if err := tray.Show(0, "LogMonitor Chat"); err != nil {
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
			time.Sleep(pollInterval)
		}
	}()

	_ = tray.Run()
}
