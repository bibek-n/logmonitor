//go:build darwin

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/pion/webrtc/v4"
	"github.com/pion/webrtc/v4/pkg/media"
	"github.com/pion/webrtc/v4/pkg/media/h264reader"
)

// View-only on macOS: screen capture (below) works exactly like Windows, but remote INPUT
// control does not exist here. Real mouse/keyboard synthesis on macOS (CGEventPost, via the
// ApplicationServices/CoreGraphics frameworks) has no pure-Go path the way Windows' SendInput
// does through golang.org/x/sys/windows - it needs cgo, which this project deliberately keeps
// disabled everywhere (CGO_ENABLED=0 - see go.mod.win7's header comment and the release
// workflow) so every platform can cross-compile from plain ubuntu-latest runners without a
// macOS build host or Xcode command-line tools. Supporting real remote control here would mean
// adding an actual macOS-hosted CI job with cgo enabled - a real infrastructure change, not
// attempted in this pass. The data channel below is still wired up and receives input events
// exactly like Windows does; handleRemoteInput (below) just intentionally discards them
// instead of injecting anything, so an admin can see clearly (via remoteSupportLog) that a
// control attempt arrived but wasn't actionable, rather than it silently vanishing.
const captureFrameRate = 15

var (
	currentLive   *liveSession
	currentLiveMu sync.Mutex
)

type liveSession struct {
	pc        *webrtc.PeerConnection
	ffmpegCmd *exec.Cmd
	stopPoll  chan struct{}
}

// ffmpegPath looks in PATH first, then next to this running executable itself - same
// reasoning as the Windows variant, just without the .exe suffix.
func ffmpegPath() (string, error) {
	if p, err := exec.LookPath("ffmpeg"); err == nil {
		return p, nil
	}
	if exe, err := os.Executable(); err == nil {
		candidate := filepath.Join(filepath.Dir(exe), "ffmpeg")
		if _, statErr := os.Stat(candidate); statErr == nil {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("ffmpeg not found in PATH or next to the agent binary")
}

// startFfmpegCapture shells out to ffmpeg's avfoundation input (macOS's screen-capture
// input device, the Darwin analog of gdigrab on Windows/x11grab-via-scrot-etc. on Linux) and
// encodes straight to a low-latency H.264 Annex-B elementary stream on stdout - identical
// encode settings to the Windows variant, same reasoning (encode speed over compression
// efficiency for an interactive session, short fixed GOP to bound how long a lost packet can
// stick the far end on a broken frame).
//
// "1:none" selects avfoundation capture device index 1 with no audio - by convention this is
// the primary display on most Macs, but avfoundation's device *numbering* isn't guaranteed
// stable across machines/macOS versions the way gdigrab's fixed "desktop" identifier is on
// Windows (it depends on what other capture-capable devices - iOS screen sharing, capture
// cards, etc. - are enumerated first). This is the one real known gap versus Windows/Linux
// parity here: a device where the primary display isn't at index 1 will fail to start a
// session, surfaced via remoteSupportLog, not silently. Worth revisiting (e.g. probing
// `ffmpeg -f avfoundation -list_devices true -i ""` output at runtime to find "Capture
// screen 0" reliably) if this turns out to matter across real hardware.
func startFfmpegCapture(track *webrtc.TrackLocalStaticSample) (*exec.Cmd, error) {
	ffmpeg, err := ffmpegPath()
	if err != nil {
		return nil, err
	}

	cmd := exec.Command(ffmpeg,
		"-f", "avfoundation",
		"-framerate", fmt.Sprintf("%d", captureFrameRate),
		"-i", "1:none",
		"-vcodec", "libx264",
		"-preset", "ultrafast",
		"-tune", "zerolatency",
		"-pix_fmt", "yuv420p",
		"-profile:v", "baseline",
		"-x264-params", fmt.Sprintf("keyint=%d:scenecut=0", captureFrameRate*2),
		"-f", "h264",
		"-",
	)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}

	go func() {
		reader, err := h264reader.NewReader(stdout)
		if err != nil {
			remoteSupportLog("h264reader init failed: %v", err)
			return
		}
		frameDuration := time.Second / captureFrameRate
		for {
			nal, err := reader.NextNAL()
			if err != nil {
				return // ffmpeg exited or pipe closed - stopLiveSession already tore this down
			}
			if writeErr := track.WriteSample(media.Sample{Data: nal.Data, Duration: frameDuration}); writeErr != nil {
				return
			}
		}
	}()

	return cmd, nil
}

// handleRemoteInput intentionally discards every event - see this file's package comment for
// why real input injection isn't implemented on macOS. Logged (not silent) so an admin
// reviewing remote-support.log can tell a control attempt arrived rather than assuming a bug
// dropped it.
func handleRemoteInput(data []byte, permissionsGranted string) {
	if !hasPermission(permissionsGranted, "control") {
		return
	}
	remoteSupportLog("remote input event received but macOS remote control is not supported (view-only) - discarding")
}

// hasPermission is duplicated from remotesupport_input_windows.go (that file's build tag
// restricts it to GOOS=windows) - trivial enough that sharing it isn't worth restructuring
// around, same reasoning as service_darwin.go's duplicated mustLoadConfig.
func hasPermission(granted, want string) bool {
	for _, p := range strings.Split(granted, ",") {
		if strings.TrimSpace(p) == want {
			return true
		}
	}
	return false
}

func toPionICEServers(servers []iceServer) []webrtc.ICEServer {
	out := make([]webrtc.ICEServer, 0, len(servers))
	for _, s := range servers {
		out = append(out, webrtc.ICEServer{
			URLs:       []string(s.URLs),
			Username:   s.Username,
			Credential: s.Credential,
		})
	}
	return out
}

// startLiveSession mirrors the Windows variant exactly (same PeerConnection/offer/signaling
// shape - see that file's doc comment for the full protocol reasoning); the only differences
// are startFfmpegCapture's avfoundation input above and handleRemoteInput's no-op above.
func startLiveSession(cfg *ChatConfig, session *remoteSessionInfo) error {
	currentLiveMu.Lock()
	defer currentLiveMu.Unlock()

	if currentLive != nil {
		return fmt.Errorf("a live session is already running")
	}

	mediaEngine := &webrtc.MediaEngine{}
	if err := mediaEngine.RegisterDefaultCodecs(); err != nil {
		return err
	}
	api := webrtc.NewAPI(webrtc.WithMediaEngine(mediaEngine))

	pc, err := api.NewPeerConnection(webrtc.Configuration{ICEServers: toPionICEServers(session.IceServers)})
	if err != nil {
		return err
	}

	videoTrack, err := webrtc.NewTrackLocalStaticSample(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264},
		"screen", "logmonitor-remote-support",
	)
	if err != nil {
		_ = pc.Close()
		return err
	}
	rtpSender, err := pc.AddTrack(videoTrack)
	if err != nil {
		_ = pc.Close()
		return err
	}
	// RTCP must be drained or the sender's internal buffers stall the track.
	go func() {
		buf := make([]byte, 1500)
		for {
			if _, _, rtcpErr := rtpSender.Read(buf); rtcpErr != nil {
				return
			}
		}
	}()

	permissionsGranted := session.PermissionsGranted
	dataChannel, err := pc.CreateDataChannel("input", nil)
	if err != nil {
		_ = pc.Close()
		return err
	}
	dataChannel.OnMessage(func(msg webrtc.DataChannelMessage) {
		handleRemoteInput(msg.Data, permissionsGranted)
	})

	ffmpegCmd, err := startFfmpegCapture(videoTrack)
	if err != nil {
		_ = pc.Close()
		return err
	}

	offer, err := pc.CreateOffer(nil)
	if err != nil {
		killFfmpeg(ffmpegCmd)
		_ = pc.Close()
		return err
	}
	gatherComplete := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(offer); err != nil {
		killFfmpeg(ffmpegCmd)
		_ = pc.Close()
		return err
	}
	<-gatherComplete

	local := pc.LocalDescription()
	if local == nil {
		killFfmpeg(ffmpegCmd)
		_ = pc.Close()
		return fmt.Errorf("no local description after ICE gathering")
	}
	if err := postSignal(cfg, session.SessionID, "offer", local.SDP); err != nil {
		killFfmpeg(ffmpegCmd)
		_ = pc.Close()
		return err
	}

	stopPoll := make(chan struct{})
	go signalPollLoop(cfg, session.SessionID, pc, stopPoll)

	currentLive = &liveSession{pc: pc, ffmpegCmd: ffmpegCmd, stopPoll: stopPoll}
	remoteSupportLog("started live session %d (view-only)", session.SessionID)
	return nil
}

func signalPollLoop(cfg *ChatConfig, sessionID int, pc *webrtc.PeerConnection, stop chan struct{}) {
	ticker := time.NewTicker(1500 * time.Millisecond)
	defer ticker.Stop()
	answered := false
	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			messages, err := pollSignal(cfg, sessionID)
			if err != nil {
				continue
			}
			for _, m := range messages {
				switch m.MessageType {
				case "answer":
					if answered {
						continue
					}
					if setErr := pc.SetRemoteDescription(webrtc.SessionDescription{
						Type: webrtc.SDPTypeAnswer, SDP: m.Payload,
					}); setErr != nil {
						remoteSupportLog("failed to set remote description for session %d: %v", sessionID, setErr)
						continue
					}
					answered = true
				case "ice-candidate":
					var candidate webrtc.ICECandidateInit
					if jsonErr := json.Unmarshal([]byte(m.Payload), &candidate); jsonErr == nil {
						_ = pc.AddICECandidate(candidate)
					}
				}
			}
		}
	}
}

func killFfmpeg(cmd *exec.Cmd) {
	if cmd != nil && cmd.Process != nil {
		_ = cmd.Process.Kill()
	}
}

func stopLiveSession() {
	currentLiveMu.Lock()
	defer currentLiveMu.Unlock()
	if currentLive == nil {
		return
	}
	close(currentLive.stopPoll)
	killFfmpeg(currentLive.ffmpegCmd)
	_ = currentLive.pc.Close()
	remoteSupportLog("stopped live session")
	currentLive = nil
}
