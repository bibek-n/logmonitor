//go:build !windows

package main

// Remote Support's live capture/control session is Windows-only for now (ffmpeg's gdigrab
// input and SendInput injection are both Win32-specific) - on Linux the poll loop in
// remotesupport.go still runs and will still open the consent tab for a Pending request, but
// there is no employee desktop to capture/control on this platform's supported deployments, so
// this just logs and no-ops rather than pretending to start a session that can't work.
func startLiveSession(cfg *chatConfig, session *remoteSessionInfo) error {
	remoteSupportLog("remote support live session requested (id=%d) but this platform is not supported", session.SessionID)
	return nil
}

func stopLiveSession() {}
