package main

import (
	"bytes"
	"context"
	"log"
	"os"
	"os/exec"
	"sync"
	"time"
)

// Automation: on-demand and scheduled script execution requested from the admin dashboard.
// Same "pending request, agent picks it up on next heartbeat" delivery mechanism as malware
// scans/PHP log tails, but unlike those this needs to ship back arbitrary stdout/stderr/exit
// code for a human to read - a real capability this agent didn't have before (see the scoping
// research: no generic run-a-script primitive existed anywhere in this codebase). The server
// resolves which shell/body a target gets from that device's own OS before it's ever sent here
// - this file only ever executes whatever job.Shell says, it never branches on runtime.GOOS.
const automationOutputCapBytes = 256 * 1024 // same cap convention as phpLogTailMaxBytes
const automationDefaultTimeout = 300 * time.Second

// PendingAutomationJob mirrors one entry of the heartbeat response's pendingAutomationJobs
// array - RequestID is AutomationJobTargets.Id, a stable per-device-per-job identity the
// report-back POST references directly (unlike malware-scan's coarse "mark any unfulfilled
// request done" approach).
type PendingAutomationJob struct {
	RequestID      int    `json:"requestId"`
	JobID          int    `json:"jobId"`
	ScriptBody     string `json:"scriptBody"`
	Shell          string `json:"shell"` // "powershell" | "bash"
	TimeoutSeconds int    `json:"timeoutSeconds"`
}

type automationResultPayload struct {
	RequestID    int    `json:"requestId"`
	Status       string `json:"status"` // Success|Failed|TimedOut|Error
	ExitCode     *int   `json:"exitCode"`
	Stdout       string `json:"stdout"`
	Stderr       string `json:"stderr"`
	ErrorMessage string `json:"errorMessage,omitempty"`
}

// capturingWriter bounds how much of a script's stdout/stderr the agent holds in memory and
// ships back - mirrors phpLogTailMaxBytes's reasoning: enough context for a real failure
// without risking a multi-GB upload if a script goes into a runaway output loop.
type capturingWriter struct {
	buf       bytes.Buffer
	truncated bool
}

func (w *capturingWriter) Write(p []byte) (int, error) {
	if remaining := automationOutputCapBytes - w.buf.Len(); remaining > 0 {
		if len(p) > remaining {
			w.buf.Write(p[:remaining])
			w.truncated = true
		} else {
			w.buf.Write(p)
		}
	} else {
		w.truncated = true
	}
	return len(p), nil // always report the full length written - callers must never see a short-write error
}

func (w *capturingWriter) String() string {
	if w.truncated {
		return w.buf.String() + "\n...[output truncated]"
	}
	return w.buf.String()
}

// runAutomationScript writes the script body to a temp file and runs it via -File/a real
// script path (never inline via -Command or `sh -c "..."`) - same reasoning as
// runPowerShellScript in iis.go: multi-line, quote-heavy scripts are exactly the case that
// breaks command-line reconstruction. Unlike every other exec helper in this agent, this one
// needs the full stdout/stderr/exit code, not a parsed/trimmed tool output - it's shipping
// arbitrary admin-authored script output back for a human to read.
func runAutomationScript(job PendingAutomationJob) automationResultPayload {
	result := automationResultPayload{RequestID: job.RequestID}

	ext := ".ps1"
	if job.Shell == "bash" {
		ext = ".sh"
	}
	tmpFile, err := os.CreateTemp("", "logmonitor-automation-*"+ext)
	if err != nil {
		result.Status = "Error"
		result.ErrorMessage = "Could not create a temp script file: " + err.Error()
		return result
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.WriteString(job.ScriptBody); err != nil {
		tmpFile.Close()
		result.Status = "Error"
		result.ErrorMessage = "Could not write the script body: " + err.Error()
		return result
	}
	tmpFile.Close()

	timeout := time.Duration(job.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = automationDefaultTimeout
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	var cmd *exec.Cmd
	if job.Shell == "bash" {
		cmd = exec.CommandContext(ctx, "bash", tmpFile.Name())
	} else {
		cmd = exec.CommandContext(ctx, "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", tmpFile.Name())
	}

	var stdout, stderr capturingWriter
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	runErr := cmd.Run()
	result.Stdout = stdout.String()
	result.Stderr = stderr.String()

	if ctx.Err() == context.DeadlineExceeded {
		result.Status = "TimedOut"
		result.ErrorMessage = "Script exceeded its configured timeout and was terminated."
		return result
	}

	if runErr != nil {
		if exitErr, ok := runErr.(*exec.ExitError); ok {
			code := exitErr.ExitCode()
			result.ExitCode = &code
			result.Status = "Failed"
			return result
		}
		result.Status = "Error"
		result.ErrorMessage = "Failed to start the script: " + runErr.Error()
		return result
	}

	code := 0
	result.ExitCode = &code
	result.Status = "Success"
	return result
}

// runningAutomationJobs guards against re-dispatching the same request across heartbeats while
// it's still executing - a script can legitimately run for minutes, and the server-side row
// stays Status='Pending' until the agent's result POST lands, so without this the same request
// would reappear in the very next 30s heartbeat's pending list and run a second time
// concurrently. Keyed by RequestID (AutomationJobTargets.Id) rather than a single atomic flag
// (the malware-scan pattern) since several distinct jobs can legitimately be pending for the
// same device at once, each independent of the others.
var runningAutomationJobs sync.Map // map[int]struct{}

// handlePendingAutomationJobs runs in its own goroutine per job (called from run.go's
// heartbeat loop, same non-blocking reasoning as triggerMalwareScanNow/
// handlePendingPhpLogRequests) - a script can take up to its own configured timeout, and must
// never delay subsequent heartbeats.
func handlePendingAutomationJobs(client *Client, jobs []PendingAutomationJob) {
	for _, job := range jobs {
		if _, alreadyRunning := runningAutomationJobs.LoadOrStore(job.RequestID, struct{}{}); alreadyRunning {
			continue
		}
		go func(j PendingAutomationJob) {
			defer runningAutomationJobs.Delete(j.RequestID)
			result := runAutomationScript(j)
			if err := client.PostAutomationResult(result); err != nil {
				log.Printf("automation result upload failed (request %d): %v", j.RequestID, err)
			}
		}(job)
	}
}
