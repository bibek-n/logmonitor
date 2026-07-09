package main

import (
	"log"
	"time"
)

// Run is the agent's main loop: heartbeat + metrics every heartbeatIntervalSeconds,
// screenshot capture driven by whatever the server's heartbeat response says right now
// (a pending on-demand request, or the configured recurring interval) — never a value
// cached locally, so an admin's settings change takes effect on the very next heartbeat.
func Run(cfg *Config, stop <-chan struct{}) {
	client := NewClient(cfg.ServerURL, cfg.DeviceID, cfg.APIKey)
	interval := time.Duration(cfg.HeartbeatIntervalSeconds) * time.Second

	var screenshotMonitoringActive bool
	var lastIntervalCapture time.Time

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			hb, err := client.Heartbeat()
			if err != nil {
				log.Printf("heartbeat failed: %v", err)
				continue
			}

			active := hb.ScreenshotIntervalMinutes != nil && !hb.PrivacyMode
			if active && !screenshotMonitoringActive {
				notify("LogMonitor Agent", "Screenshot monitoring is now active on this device.")
			} else if !active && screenshotMonitoringActive {
				notify("LogMonitor Agent", "Screenshot monitoring has stopped on this device.")
			}
			screenshotMonitoringActive = active

			if metrics := CollectMetrics(); true {
				if err := client.PostMetrics(metrics); err != nil {
					log.Printf("metrics upload failed: %v", err)
				}
			}

			shouldCaptureManual := hb.PendingScreenshotRequest && !hb.PrivacyMode
			shouldCaptureInterval := active && hb.ScreenshotIntervalMinutes != nil &&
				time.Since(lastIntervalCapture) >= time.Duration(*hb.ScreenshotIntervalMinutes)*time.Minute

			if shouldCaptureManual {
				captureAndUpload(client, "manual")
			} else if shouldCaptureInterval {
				captureAndUpload(client, "interval")
				lastIntervalCapture = time.Now()
			}
		}
	}
}

func captureAndUpload(client *Client, capturedBy string) {
	png, err := CaptureScreenshot()
	if err != nil {
		log.Printf("screenshot capture failed: %v", err)
		return
	}
	if err := client.UploadScreenshot(png, capturedBy); err != nil {
		log.Printf("screenshot upload failed: %v", err)
	}
}
