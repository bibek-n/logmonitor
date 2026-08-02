//go:build windows && legacy_win7

package main

// The live capture/control session depends on github.com/pion/webrtc/v4, which isn't pinned
// into go.mod.win7's dependency set (see that file's header comment) - same "not buildable
// under the Go 1.20/legacy toolchain" constraint that already stubs out the Browser Activity
// collector for this build. A Windows 7 endpoint still enrolls and shows up in Remote Support's
// device list, but live screen sharing isn't offered there.
func startLiveSession(cfg *ChatConfig, session *remoteSessionInfo) error {
	remoteSupportLog("remote support live session requested (id=%d) but this legacy Windows 7 build does not support it", session.SessionID)
	return nil
}

func stopLiveSession() {}
