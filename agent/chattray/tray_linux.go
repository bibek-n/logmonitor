package main

import (
	"log"
	"time"

	"github.com/gen2brain/beeep"
)

// tadvi/systray has no real Linux implementation (its systray_linux.go is an empty stub —
// verified locally, not assumed) — Linux gets a notification-only fallback instead, reusing
// the same beeep path the main agent already uses successfully (agent/notify.go). No tray
// icon, no click-to-open; the notification body carries the chat URL so the employee can
// open it manually (most desktop notification daemons render a URL as tappable/copyable).
func runTray(cfg *chatConfig) {
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
		time.Sleep(pollInterval)
	}
}
