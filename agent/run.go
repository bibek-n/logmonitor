package main

import (
	"log"
	"os"
	"runtime"
	"runtime/debug"
	"time"
)

// recoverAndLog turns an unhandled panic in the labeled goroutine into a logged stack
// trace instead of a silent process crash. Before setupFileLogging existed, a panic
// here was invisible: no console (service mode), no Windows Event Log entry, nothing -
// just the Windows Service Control Manager restarting the whole process per
// configureRestartOnFailure's recovery policy, every time, forever. Every long-running
// goroutine Run starts below is wrapped with this, plus the heartbeat tick body itself
// (by far the most code running per cycle, and empirically where this was happening -
// Services/Software/Security/Network/Hardware/LocalUsers/Logs collection and the update
// check all fire unconditionally on the very first tick, since their last-run
// timestamps start at zero).
func recoverAndLog(label string) {
	if r := recover(); r != nil {
		log.Printf("PANIC recovered in %s: %v\n%s", label, r, debug.Stack())
	}
}

const (
	processesInterval                 = 90 * time.Second
	servicesInterval                  = 8 * time.Minute
	softwareInterval                  = 24 * time.Hour
	securityInterval                  = 3 * time.Minute
	networkInterval                   = 3 * time.Minute
	hardwareInterval                  = 24 * time.Hour
	localUsersInterval                = 24 * time.Hour
	usbPollInterval                   = 8 * time.Second
	updateInterval                    = 1 * time.Hour
	logsInterval                      = 60 * time.Second
	windowsUpdateInterval             = 6 * time.Hour
	updateScanInterval                = 6 * time.Hour
	chatWatchdogInterval              = 3 * time.Minute
	wazuhOfficeSecurityEventsInterval = 3 * time.Minute
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
	var browserActivityMonitoringActive bool
	var appActivityMonitoringActive bool
	var lastIntervalCapture time.Time
	var lastBrowserHistory time.Time
	var lastProcesses, lastServices, lastSoftware, lastSecurity, lastNetwork, lastHardware, lastLocalUsers, lastUpdateCheck, lastLogs, lastWindowsUpdate, lastWazuhOfficeSecurityEvents, lastUpdateScan time.Time

	// USB detection runs on its own fast ticker rather than piggybacking on the main
	// heartbeat loop below - the heartbeat interval is 30s, which made a plug/unplug take
	// up to 30s just to be *detected*, on top of however long the dashboard's own poll
	// took to notice it. Decoupling it here means it's bounded by usbPollInterval alone.
	go func() { defer recoverAndLog("runUsbPolling"); runUsbPolling(client, stop) }()
	go func() { defer recoverAndLog("runIisPolling"); runIisPolling(client, stop) }()
	go func() { defer recoverAndLog("runLinuxSecurityPolling"); runLinuxSecurityPolling(client, stop) }()
	go func() { defer recoverAndLog("runMalwarePolling"); runMalwarePolling(client, stop) }()
	go func() { defer recoverAndLog("runPhpPolling"); runPhpPolling(client, stop) }()
	go func() { defer recoverAndLog("runWeblogTailing"); runWeblogTailing(client, stop) }()
	go func() { defer recoverAndLog("runForegroundPolling"); runForegroundPolling(stop) }()
	// Live per-adapter bandwidth (5-second samples, reported every 10 seconds) - see bandwidth.go.
	// Own goroutine: never waits on, or delays, the heartbeat or the collection worker.
	go func() {
		defer recoverAndLog("runBandwidthMonitor")
		hostname, _ := os.Hostname()
		runBandwidthMonitor(client, hostname, stop)
	}()

	// Tamper-protection watchdog for the tray/chat companion process: ensureChatCompanionAutostart
	// is already safe to call repeatedly (a relaunch attempt against an already-running tray just
	// hits its own named-mutex singleton lock and exits immediately - see
	// acquireTraySingleInstanceLock in chatcompanion_windows.go), so calling it on a timer is a
	// no-op when nothing's wrong and a real self-heal when an employee has killed the tray (e.g.
	// via Task Manager) since the last check. No-op on non-Windows builds for now - see the
	// ensureChatCompanionAutostart stubs in chatcompanion_darwin.go/chatcompanion_linux.go.
	go func() { defer recoverAndLog("runChatCompanionWatchdog"); runChatCompanionWatchdog(stop) }()

	// A leftover in-flight marker means the previous agent process died in the middle of an approved update install:
	// tell the server (it is never repeated automatically).
	go func() { defer recoverAndLog("reportInterruptedInstall"); reportInterruptedInstall(client) }()

	// Liveness tracking for runLivenessWatchdog (see its doc comment). The heartbeat loop and the
	// collection worker below each stamp their progress here; the watchdog restarts the process
	// if either one stops making progress.
	live := &livenessState{}
	live.lastHeartbeatAttempt.Store(time.Now().UnixNano())
	go func() { defer recoverAndLog("runLivenessWatchdog"); runLivenessWatchdog(interval, live, stop) }()

	// runCycle is everything a successful heartbeat triggers except the power action: metrics,
	// screenshots, every inventory/posture collector, update checks. It used to run inline on
	// the heartbeat loop itself, so ONE collector that never returned (a WMI/PowerShell/netsh
	// call stalling while Windows re-identifies a newly joined network is the real-world case -
	// an employee switching Wi-Fi) froze the heartbeat too: the device stayed silent, the
	// dashboard showed the employee offline while their PC sat on the network, and nothing
	// recovered until the service was restarted by hand. It now runs on its own worker
	// goroutine (below), so heartbeats keep flowing no matter what a collector does, and the
	// watchdog recovers a collector that's truly stuck. Only ever called from that single
	// worker goroutine, so the closure state it captures above needs no locking.
	runCycle := func(hb *HeartbeatResponse) {
		// Wake-on-LAN relay: own goroutine, so a slow send never delays the next heartbeat.
		// Unlike the power action above this sends first and acks after - see
		// handlePendingWakeRequests.
		if len(hb.PendingWakeRequests) > 0 {
			go handlePendingWakeRequests(client, hb.PendingWakeRequests)
		}

		// Security & Updates scans requested from the dashboard - own goroutine (a Windows Update or
		// softwareupdate search can take minutes); RunUpdateScan itself skips overlapping scans.
		if len(hb.PendingUpdateRequests) > 0 {
			go handlePendingUpdateRequests(client, hb.PendingUpdateRequests)
		}

		active := hb.ScreenshotIntervalMinutes != nil && !hb.PrivacyMode
		if active && !screenshotMonitoringActive {
			notify("LogMonitor Agent", "Screenshot monitoring is now active on this device.")
		} else if !active && screenshotMonitoringActive {
			notify("LogMonitor Agent", "Screenshot monitoring has stopped on this device.")
		}
		screenshotMonitoringActive = active

		// Browser Activity Audit: driven entirely by the heartbeat's own field, same as
		// screenshots above - never a separate ticker, since an admin turning this off
		// must take effect within one heartbeat interval, not whenever some independent
		// goroutine happens to notice.
		browserActivityActive := hb.BrowserActivityIntervalMinutes != nil && !hb.PrivacyMode
		if browserActivityActive && !browserActivityMonitoringActive {
			notify("LogMonitor Agent", "Browser activity monitoring is now active on this device.")
		} else if !browserActivityActive && browserActivityMonitoringActive {
			notify("LogMonitor Agent", "Browser activity monitoring has stopped on this device.")
		}
		browserActivityMonitoringActive = browserActivityActive

		if browserActivityActive && time.Since(lastBrowserHistory) >= time.Duration(*hb.BrowserActivityIntervalMinutes)*time.Minute {
			// Own goroutine - reading several users' Chrome/Edge/Firefox history DBs can
			// take a moment, and must never delay the next heartbeat, same reasoning as
			// the malware scan/PHP log/automation cases below.
			go func(suffixes []string) {
				if events := CollectBrowserHistory(suffixes); len(events) > 0 {
					if err := client.PostBrowserActivity(events); err != nil {
						log.Printf("browser activity upload failed: %v", err)
					}
				}
			}(hb.ExcludedDomainSuffixes)
			lastBrowserHistory = time.Now()
		}

		// Employee Application Activity Monitoring: foreground/idle tracking is driven
		// entirely by the heartbeat's own fields, same as browser activity above - an
		// admin's change (device opt-in/out, idle timeout, window-title toggle, excluded
		// apps) takes effect within one heartbeat interval, not whenever runForegroundPolling
		// next happens to notice. runForegroundPolling itself is always running (started
		// once above); this just updates the flags it reads on its own ticker.
		appActivityActive := hb.AppActivityIntervalMinutes != nil && !hb.PrivacyMode
		idleTimeoutSeconds := 300
		if hb.AppActivityIdleTimeoutSeconds != nil {
			idleTimeoutSeconds = *hb.AppActivityIdleTimeoutSeconds
		}
		SetForegroundTrackingConfig(appActivityActive, idleTimeoutSeconds, hb.AppActivityCollectWindowTitles)
		SetForegroundExcludedProcessNames(hb.AppActivityExcludedProcessNames)
		if appActivityActive && !appActivityMonitoringActive {
			notify("LogMonitor Agent", "Application activity monitoring is now active on this device.")
		} else if !appActivityActive && appActivityMonitoringActive {
			notify("LogMonitor Agent", "Application activity monitoring has stopped on this device.")
		}
		appActivityMonitoringActive = appActivityActive

		if metrics := CollectMetrics(); true {
			if err := client.PostMetrics(metrics); err != nil {
				log.Printf("metrics upload failed: %v", err)
			}
		}

		// Runs in its own goroutine (see triggerMalwareScanNow) - a scan can take minutes,
		// and unlike the screenshot capture below this must never block subsequent
		// heartbeats from going out on schedule.
		if hb.PendingMalwareScanRequest {
			triggerMalwareScanNow(client)
		}

		// Same non-blocking reasoning as the malware scan above - reading a log tail is
		// quick, but there's no need to risk it on the heartbeat's own critical path.
		if len(hb.PendingPhpLogRequests) > 0 {
			go handlePendingPhpLogRequests(client, hb.PendingPhpLogRequests)
		}

		// Same non-blocking reasoning as the malware scan/PHP log cases above - a script can
		// run for up to its own configured timeout, and must never delay the next heartbeat.
		// handlePendingAutomationJobs dispatches each job into its own goroutine internally
		// (not wrapped in `go` here) since it also needs to de-dup against jobs already
		// in flight from a previous heartbeat before deciding whether to spawn one at all.
		if len(hb.PendingAutomationJobs) > 0 {
			handlePendingAutomationJobs(client, hb.PendingAutomationJobs)
		}

		// Runs every heartbeat (not just when non-empty) - ApplyUsbPolicy itself needs to
		// see an empty list to know a previously-active Block entry was removed and
		// re-enable whatever it had disabled. In its own goroutine since it shells out to
		// PowerShell (registry + Disable-PnpDevice) per matching device, same non-blocking
		// reasoning as the malware scan/PHP log cases above. No-op on non-Windows builds -
		// see usbpolicy_other.go.
		go ApplyUsbPolicy(client, UsbPolicy{Entries: hb.UsbBlockList, BlockAllStorage: hb.UsbBlockAllStorage})

		// Website Access Control enforcement: same unconditional/every-heartbeat/own-goroutine
		// convention as ApplyUsbPolicy just above, for the same reason - ApplyWacBlocklist
		// itself needs to see an empty list to know a previously-applied hosts-file block (and
		// any DoH policy value it set) should be reversed. No-op on non-Windows builds - see
		// wacblock_other.go. Ships inert for any device where the server hasn't explicitly
		// enabled website blocking (Devices.WebsiteBlockingEnabled), in which case
		// hb.WacBlockedDomains is always an empty list - see /api/agent/heartbeat/route.ts.
		go ApplyWacBlocklist(client, hb.WacBlockedDomains)

		// Same non-blocking reasoning - a watched file could sit on a slow network share,
		// and this must never delay the next heartbeat.
		if len(hb.WatchedFiles) > 0 {
			go func() {
				for _, change := range CheckWatchedFiles(hb.WatchedFiles) {
					if err := client.PostFileIntegrityEvent(change); err != nil {
						log.Printf("file integrity event upload failed (%s): %v", change.FilePath, err)
					}
				}
			}()
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

		if now.Sub(lastProcesses) >= processesInterval {
			procs := CollectProcesses()
			// Merge in whatever active/idle-second deltas and window titles
			// runForegroundPolling has accumulated since the last drain - empty/zero for
			// every process on a device that isn't opted into app activity tracking (or on
			// non-Windows builds, see foreground_other.go), in which case this is a no-op
			// and the payload is unchanged from before this feature existed.
			deltas := drainForegroundDeltas()
			for i := range procs {
				if d, ok := deltas[procs[i].Name]; ok {
					procs[i].ActiveSeconds = d.ActiveSeconds
					procs[i].IdleSeconds = d.IdleSeconds
					procs[i].WindowTitle = d.WindowTitle
				}
			}
			client.sendProcessesWithSpool(procs)
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
		if now.Sub(lastLocalUsers) >= localUsersInterval {
			if err := client.PostLocalUsers(CollectLocalUsers()); err != nil {
				log.Printf("local users upload failed: %v", err)
			}
			lastLocalUsers = now
		}
		if now.Sub(lastUpdateCheck) >= updateInterval {
			targetVersion := ""
			if hb.AgentTargetVersion != nil {
				targetVersion = *hb.AgentTargetVersion
			}
			CheckForUpdate(AgentVersion, targetVersion)
			lastUpdateCheck = now
		}
		if now.Sub(lastLogs) >= logsInterval {
			if entries := CollectNewLogLines(); len(entries) > 0 {
				if err := client.PostLogs(entries); err != nil {
					log.Printf("log shipping failed: %v", err)
				}
			}
			lastLogs = now
		}
		if runtime.GOOS == "windows" && now.Sub(lastWindowsUpdate) >= windowsUpdateInterval {
			if err := client.PostWindowsUpdateStatus(CollectWindowsUpdateStatus()); err != nil {
				log.Printf("windows update status upload failed: %v", err)
			}
			lastWindowsUpdate = now
		}
		if now.Sub(lastWazuhOfficeSecurityEvents) >= wazuhOfficeSecurityEventsInterval {
			if events := CollectWazuhOfficeSecurityEvents(); len(events) > 0 {
				if err := client.PostWazuhOfficeEvents(events); err != nil {
					log.Printf("wazuh office security event upload failed: %v", err)
				}
			}
			lastWazuhOfficeSecurityEvents = now
		}
		// Scheduled Security & Updates scan for every OS: first one ~2 minutes after start (so a fresh
		// install shows data quickly without adding to startup load), then every updateScanInterval.
		if lastUpdateScan.IsZero() {
			lastUpdateScan = now.Add(-updateScanInterval + 2*time.Minute)
		}
		if now.Sub(lastUpdateScan) >= updateScanInterval {
			go RunUpdateScan(client, "scheduled", 0)
			lastUpdateScan = now
		}
	}

	// Collection worker: runs one runCycle at a time. Unbuffered on purpose - if a cycle is
	// still running when the next heartbeat succeeds, that heartbeat's cycle is skipped (and
	// logged) rather than queued, so a slow or stuck collector can never build a backlog of
	// stale work, and never delays the heartbeat that's already gone out.
	cycles := make(chan *HeartbeatResponse)
	go func() {
		for {
			select {
			case <-stop:
				return
			case hb := <-cycles:
				live.cycleStartedAt.Store(time.Now().UnixNano())
				func() {
					// Own recover: a panic in any single collector degrades to one logged, skipped
					// cycle instead of silently taking down the whole process (see setupFileLogging).
					defer recoverAndLog("collection cycle")
					runCycle(hb)
				}()
				live.cycleStartedAt.Store(0)
			}
		}
	}()

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			hb, err := client.Heartbeat()
			live.lastHeartbeatAttempt.Store(time.Now().UnixNano())
			EvaluatePendingUpdate(err == nil)
			if err != nil {
				log.Printf("heartbeat failed: %v", err)
				continue
			}
			// Stays on the heartbeat loop rather than the collection worker: a remote reboot is
			// exactly how an admin recovers a machine whose collectors are misbehaving, so it must
			// never wait behind them.
			func() {
				defer recoverAndLog("power action")
				handlePendingPowerAction(client, hb)
			}()
			select {
			case cycles <- hb:
			default:
				if started := live.cycleStartedAt.Load(); started != 0 {
					log.Printf("previous collection cycle still running (%s); heartbeat sent, skipping this cycle's collection",
						time.Since(time.Unix(0, started)).Round(time.Second))
				}
			}
		}
	}
}

// handlePendingPowerAction runs an admin-requested reboot/shutdown/logoff. ACK first (clears the
// pending request server-side), and only execute if that ack succeeds - if the ack fails (network
// blip), skip execution entirely and let the next heartbeat retry the whole ack-then-execute
// sequence. Doing it the other way around (execute then ack) would mean a shutdown whose ack never
// landed reboots this same request right back into effect the moment the device is manually
// powered on again.
func handlePendingPowerAction(client *Client, hb *HeartbeatResponse) {
	if hb.PendingPowerAction == nil {
		return
	}
	action := *hb.PendingPowerAction
	if ackErr := client.AckPowerAction(); ackErr != nil {
		log.Printf("power action ack failed, will retry next heartbeat: %v", ackErr)
		return
	}
	switch action {
	case "reboot":
		log.Printf("executing admin-approved reboot request")
		if err := RebootNow(); err != nil {
			log.Printf("reboot command failed: %v", err)
		}
	case "shutdown":
		log.Printf("executing admin-approved shutdown request")
		if err := ShutdownNow(); err != nil {
			log.Printf("shutdown command failed: %v", err)
		}
	case "logoff":
		log.Printf("executing admin-approved logoff request")
		if err := LogoffNow(); err != nil {
			log.Printf("logoff command failed: %v", err)
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

// runUsbPolling owns knownUsbDevices exclusively - nothing else touches it - and ticks
// independently of the main heartbeat loop so USB detection latency is bounded by
// usbPollInterval alone, not by however long the heartbeat interval happens to be set to.
func runUsbPolling(client *Client, stop <-chan struct{}) {
	// Seeded with whatever's already plugged in at startup, not left empty - otherwise
	// every agent restart (which happens on every update, i.e. routinely) would replay a
	// synthetic "insert" event for every already-connected device, none of which is a real
	// insertion. Only devices that change state *after* this point are genuine events.
	known := map[string]UsbDeviceInfo{}
	for _, d := range CollectUsbDevices() {
		known[d.ID] = d
	}

	ticker := time.NewTicker(usbPollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			pollUsbDevices(client, known)
		}
	}
}

// runChatCompanionWatchdog re-asserts the chat companion's autostart registration and relaunches
// it for any already-logged-in session on a fixed timer, independent of the heartbeat interval -
// see the call site in Run for why this is safe to call repeatedly.
func runChatCompanionWatchdog(stop <-chan struct{}) {
	ticker := time.NewTicker(chatWatchdogInterval)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			ensureChatCompanionAutostart()
		}
	}
}

// pollUsbDevices diffs the current USB storage device list against the last known set
// and reports insert/removal events — this is polling-based (not a live OS event
// subscription) to keep the cross-platform implementation simple and dependency-free.
func pollUsbDevices(client *Client, known map[string]UsbDeviceInfo) {
	current := CollectUsbDevices()
	currentIDs := map[string]bool{}

	// Block first, report second: a blocked drive is cut off within this poll, not at the next
	// heartbeat. Every poll, not only when a device is new - a drive's disk (which is what marks
	// it as storage) can show up a moment after the drive itself.
	EnforceUsbPolicyOnPoll(client, current)

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
