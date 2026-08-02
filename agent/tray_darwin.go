//go:build darwin

package main

import (
	"log"
	"time"

	"github.com/gen2brain/beeep"
)

// tadvi/systray (used on Windows) has no darwin implementation at all (verified in its
// module source - only systray_linux.go and systray_windows.go exist), and its own Linux
// implementation is itself just an empty stub (see tray_linux.go's comment) - so this is
// genuine parity with Linux's actual behavior, not a step down from it: a notification-only
// fallback via the same beeep path already used successfully there and by the main agent's
// USB-block notifications. No tray icon, no click-to-open; the notification body carries the
// chat URL so the employee can open it manually.
func runTray(cfg *ChatConfig) {
	lastUnread := 0
	for {
		resp, err := pollUnread(cfg)
		if err == nil && resp.OK && resp.ChatAvailable && resp.UnreadCount > 0 && resp.UnreadCount > lastUnread {
			if err := beeep.Notify("New message from IT Support", "Open the chat: "+chatPageURL(cfg), ""); err != nil {
				log.Printf("chat notification failed (expected without a desktop session): %v", err)
			}
		}
		if resp != nil {
			lastUnread = resp.UnreadCount
		}
		if nresp, err := pollNotifications(cfg); err == nil && nresp.OK {
			for _, n := range nresp.Notifications {
				if err := beeep.Notify("Notification from Admin", n.Message, ""); err != nil {
					log.Printf("admin notification failed (expected without a desktop session): %v", err)
				}
			}
		}
		time.Sleep(pollInterval)
	}
}
