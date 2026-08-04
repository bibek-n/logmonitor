// Remote Support (Phase 3, employee side). This file is the cross-platform half: it polls
// the ChatToken-gated /chat/session route (the same low-privilege credential the chat companion
// mode already uses - see chatcompanion_run.go's comment on why it never touches the device's
// full API key) and hands off to startLiveSession/stopLiveSession, which are implemented for
// real only on Windows (remotesupport_capture_windows.go + remotesupport_input_windows.go) and
// stubbed out everywhere else (remotesupport_stub.go), the same per-platform-file pattern
// already used for runTray and hasDesktopSession.
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"os"
	"path/filepath"
	"time"
)

const remoteSupportPollInterval = 3 * time.Second

// urlsField accepts the IceServerConfig.urls shape from the server, which is `string |
// string[]` (see src/lib/remoteSupport/types.ts) - coturn's REST API and browsers both accept
// either, so the server doesn't normalize it before sending it down.
type urlsField []string

func (u *urlsField) UnmarshalJSON(data []byte) error {
	var single string
	if err := json.Unmarshal(data, &single); err == nil {
		*u = []string{single}
		return nil
	}
	var multi []string
	if err := json.Unmarshal(data, &multi); err != nil {
		return err
	}
	*u = multi
	return nil
}

type iceServer struct {
	URLs       urlsField `json:"urls"`
	Username   string    `json:"username,omitempty"`
	Credential string    `json:"credential,omitempty"`
}

type remoteSessionInfo struct {
	SessionID          int         `json:"sessionId"`
	Status             string      `json:"status"`
	PermissionsGranted string      `json:"permissionsGranted"`
	TerminationReason  *string     `json:"terminationReason"`
	IceServers         []iceServer `json:"iceServers"`
}

type remoteSessionResponse struct {
	OK      bool               `json:"ok"`
	Session *remoteSessionInfo `json:"session"`
}

// fetchRemoteSession polls /chat/session, which reports every status (Pending/Active/
// Ended/Rejected/Expired) for the device's most recent session - see chat/session/route.ts.
// A nil session (with no error) means "nothing going on right now", not a failure.
func fetchRemoteSession(cfg *ChatConfig) (*remoteSessionInfo, error) {
	u := fmt.Sprintf("%s/api/agent/remote-support/chat/session?deviceId=%s&token=%s",
		cfg.ServerURL, url.QueryEscape(cfg.DeviceID), url.QueryEscape(cfg.ChatToken))
	resp, err := httpClient.Get(u)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var out remoteSessionResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	if !out.OK {
		return nil, fmt.Errorf("session poll returned ok=false")
	}
	return out.Session, nil
}

type signalMessage struct {
	ID          int    `json:"id"`
	MessageType string `json:"messageType"`
	Payload     string `json:"payload"`
}

type signalPostBody struct {
	DeviceID  string `json:"deviceId"`
	Token     string `json:"token"`
	SessionID int    `json:"sessionId"`
	Type      string `json:"type"`
	Payload   string `json:"payload"`
}

type signalPostResponse struct {
	OK    bool   `json:"ok"`
	Error string `json:"error"`
}

// postSignal sends this agent's SDP offer (there is no per-candidate trickle - see
// remotesupport_capture_windows.go for why vanilla/non-trickle ICE was chosen).
func postSignal(cfg *ChatConfig, sessionID int, messageType, payload string) error {
	body, err := json.Marshal(signalPostBody{
		DeviceID: cfg.DeviceID, Token: cfg.ChatToken, SessionID: sessionID, Type: messageType, Payload: payload,
	})
	if err != nil {
		return err
	}
	resp, err := httpClient.Post(cfg.ServerURL+"/api/agent/remote-support/chat/signal", "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	var out signalPostResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return err
	}
	if !out.OK {
		return fmt.Errorf("signal post rejected: %s", out.Error)
	}
	return nil
}

type signalGetResponse struct {
	OK       bool            `json:"ok"`
	Error    string          `json:"error"`
	Messages []signalMessage `json:"messages"`
}

// pollSignal is a one-shot pop (see signalingRelay.ts) - every call consumes and returns only
// messages enqueued since the last call.
func pollSignal(cfg *ChatConfig, sessionID int) ([]signalMessage, error) {
	u := fmt.Sprintf("%s/api/agent/remote-support/chat/signal?deviceId=%s&token=%s&sessionId=%d",
		cfg.ServerURL, url.QueryEscape(cfg.DeviceID), url.QueryEscape(cfg.ChatToken), sessionID)
	resp, err := httpClient.Get(u)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var out signalGetResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	if !out.OK {
		return nil, fmt.Errorf("signal get rejected: %s", out.Error)
	}
	return out.Messages, nil
}

func remoteSupportConsentURL(cfg *ChatConfig) string {
	return fmt.Sprintf("%s/remote-support-consent/%s?token=%s", cfg.ServerURL, url.PathEscape(cfg.DeviceID), url.QueryEscape(cfg.ChatToken))
}

// remoteSupportLogPath is a small, bounded diagnostic log - this process has no console (it's
// launched invisibly at logon) and no existing route to report agent-side capture/peer errors
// back to the admin, so without this, "ffmpeg isn't installed" or "the peer connection failed"
// would fail completely silently. This is operational diagnostics for the feature itself
// (start/stop/error lines only - never screen content or input events), not the kind of hidden
// monitoring the spec explicitly rules out.
func remoteSupportLogPath() string {
	root := os.Getenv("ProgramData")
	if root == "" {
		root = `C:\ProgramData`
	}
	return filepath.Join(root, "LogMonitorAgent", "remote-support.log")
}

func remoteSupportLog(format string, args ...interface{}) {
	path := remoteSupportLogPath()
	if info, err := os.Stat(path); err == nil && info.Size() > 1<<20 {
		_ = os.Remove(path)
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return
	}
	defer f.Close()
	logger := log.New(f, "", log.LstdFlags)
	logger.Printf(format, args...)
}

// runRemoteSupportPoll is launched once, from main(), as its own goroutine alongside the chat
// tray - it never returns. A single flat state machine drives both halves of the employee
// experience: opening the consent tab the moment a request appears, and starting/stopping the
// real capture+control session as the backend's Status column moves through
// Pending -> Active -> Ended/Rejected/Expired.
func runRemoteSupportPoll(cfg *ChatConfig) {
	var consentOpenedForSession int
	var liveSessionID int
	liveRunning := false

	for {
		time.Sleep(remoteSupportPollInterval)

		session, err := fetchRemoteSession(cfg)
		if err != nil {
			continue // transient poll failure - try again next tick, same as chat polling
		}

		if session == nil {
			if liveRunning {
				stopLiveSession()
				liveRunning = false
			}
			consentOpenedForSession = 0
			continue
		}

		switch session.Status {
		case "Pending":
			if consentOpenedForSession != session.SessionID {
				openBrowser(remoteSupportConsentURL(cfg), 420, 640)
				consentOpenedForSession = session.SessionID
			}
		case "Active":
			if !liveRunning || liveSessionID != session.SessionID {
				if liveRunning {
					stopLiveSession()
				}
				if err := startLiveSession(cfg, session); err != nil {
					remoteSupportLog("failed to start live session %d: %v", session.SessionID, err)
					liveRunning = false
				} else {
					liveRunning = true
					liveSessionID = session.SessionID
				}
			}
		default: // Ended, Rejected, Expired
			if liveRunning {
				stopLiveSession()
				liveRunning = false
			}
			if consentOpenedForSession == session.SessionID {
				consentOpenedForSession = 0
			}
		}
	}
}

// startLiveSession and stopLiveSession are implemented in remotesupport_capture_windows.go
// (real pion+ffmpeg session) and remotesupport_stub.go (no-op everywhere else).
