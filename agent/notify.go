package main

import (
	"log"

	"github.com/gen2brain/beeep"
)

// notify is best-effort — a headless Linux service host has nothing to display a
// notification on, so a failure here is logged but never fatal.
func notify(title, message string) {
	if err := beeep.Notify(title, message, ""); err != nil {
		log.Printf("notification failed (expected on a headless host): %v", err)
	}
}
