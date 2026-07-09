package main

import (
	"log"
	"time"
)

const (
	processesInterval = 90 * time.Second
	servicesInterval  = 8 * time.Minute
	softwareInterval  = 24 * time.Hour
	securityInterval  = 3 * time.Minute
	networkInterval   = 3 * time.Minute
	hardwareInterval  = 24 * time.Hour
	usbPollInterval   = 30 * time.Second
	updateInterval    = 1 * time.Hour
)

// Run is the agent's main loop: heartbeat + basic metrics every heartbeatIntervalSeconds,
// with everything else (inventories, security/network posture, USB detection, update
// checks) running on its own longer cadence tracked by last-run timestamps rather than
// tick-counting, so it stays correct regardless of what heartbeatIntervalSeconds is set
// to. Screenshot capture is still driven entirely by what the server's heartbeat
// response says right now (a pending on-demand request, or the configured interval) —
// never cached locally, so an admin's settings change takes effect on the very next beat.
func Run(cfg *Config, stop <-chan struct{}) {
	client := NewClient(cfg.ServerURL, cfg.DeviceID, cfg.APIKey)
	interval := time.Duration(cfg.HeartbeatIntervalSeconds) * time.Second

	var screenshotMonitoringActive bool
	var lastIntervalCapture time.Time
	var lastProcesses, lastServices, lastSoftware, lastSecurity, lastNetwork, lastHardware, lastUsbPoll, lastUpdateCheck time.Time
	knownUsbDevices := map[string]UsbDeviceInfo{}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			hb, err := client.Heartbeat()
			EvaluatePendingUpdate(err == nil)
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

			now := time.Now()

			if now.Sub(lastUsbPoll) >= usbPollInterval {
				pollUsbDevices(client, knownUsbDevices)
				lastUsbPoll = now
			}
			if now.Sub(lastProcesses) >= processesInterval {
				if err := client.PostProcesses(CollectProcesses()); err != nil {
					log.Printf("process snapshot upload failed: %v", err)
				}
				lastProcesses = now
			}
			if now.Sub(lastServices) >= servicesInterval {
				if err := client.PostServices(CollectServices()); err != nil {
					log.Printf("service snapshot upload failed: %v", err)
				}
				lastServices = now
			}
			if now.Sub(lastSoftware) >= softwareInterval {
				if err := client.PostSoftware(CollectSoftware()); err != nil {
					log.Printf("software snapshot upload failed: %v", err)
				}
				lastSoftware = now
			}
			if now.Sub(lastSecurity) >= securityInterval {
				if err := client.PostSecurityStatus(CollectSecurityStatus()); err != nil {
					log.Printf("security status upload failed: %v", err)
				}
				lastSecurity = now
			}
			if now.Sub(lastNetwork) >= networkInterval {
				if err := client.PostNetworkInfo(CollectNetworkInfo()); err != nil {
					log.Printf("network info upload failed: %v", err)
				}
				lastNetwork = now
			}
			if now.Sub(lastHardware) >= hardwareInterval {
				if err := client.PostHardware(CollectHardwareInfo()); err != nil {
					log.Printf("hardware info upload failed: %v", err)
				}
				lastHardware = now
			}
			if now.Sub(lastUpdateCheck) >= updateInterval {
				CheckForUpdate(AgentVersion)
				lastUpdateCheck = now
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

// pollUsbDevices diffs the current USB storage device list against the last known set
// and reports insert/removal events — this is polling-based (not a live OS event
// subscription) to keep the cross-platform implementation simple and dependency-free;
// a 30s worst-case detection delay is an acceptable tradeoff for an audit trail.
func pollUsbDevices(client *Client, known map[string]UsbDeviceInfo) {
	current := CollectUsbDevices()
	currentIDs := map[string]bool{}

	for _, d := range current {
		currentIDs[d.ID] = true
		if _, alreadyKnown := known[d.ID]; !alreadyKnown {
			known[d.ID] = d
			if err := client.PostUsbEvent("insert", d); err != nil {
				log.Printf("usb insert event upload failed: %v", err)
			}
		}
	}

	for id, d := range known {
		if !currentIDs[id] {
			delete(known, id)
			if err := client.PostUsbEvent("removal", d); err != nil {
				log.Printf("usb removal event upload failed: %v", err)
			}
		}
	}
}
