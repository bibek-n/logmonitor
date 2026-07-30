//go:build windows

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"github.com/pion/webrtc/v4"
	"github.com/pion/webrtc/v4/pkg/media"
	"github.com/pion/webrtc/v4/pkg/media/h264reader"
)

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

// ffmpegPath looks in PATH first, then next to chattray.exe itself - ffmpeg has no other
// footprint in this app, so the simplest deployable option is dropping ffmpeg.exe alongside
// the agent/chattray binaries rather than requiring a separate system-wide install step.
func ffmpegPath() (string, error) {
	if p, err := exec.LookPath("ffmpeg"); err == nil {
		return p, nil
	}
	if exe, err := os.Executable(); err == nil {
		candidate := filepath.Join(filepath.Dir(exe), "ffmpeg.exe")
		if _, statErr := os.Stat(candidate); statErr == nil {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("ffmpeg.exe not found in PATH or next to chattray.exe")
}

// startFfmpegCapture shells out to ffmpeg's gdigrab input (screen capture requires no
// additional Windows APIs/permissions beyond what the logged-in user already has) and encodes
// straight to a low-latency H.264 Annex-B elementary stream on stdout. ultrafast+zerolatency
// trade compression efficiency for encode speed, which matters far more than bandwidth for an
// interactive support session; a short, fixed GOP (keyint=30, no scene-cut insertion) bounds
// how long the far end can be stuck on a broken frame after any packet loss.
func startFfmpegCapture(track *webrtc.TrackLocalStaticSample) (*exec.Cmd, error) {
	ffmpeg, err := ffmpegPath()
	if err != nil {
		return nil, err
	}

	cmd := exec.Command(ffmpeg,
		"-f", "gdigrab",
		"-framerate", fmt.Sprintf("%d", captureFrameRate),
		"-i", "desktop",
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

// startLiveSession builds the pion PeerConnection as the OFFERER (per the Phase 1 sequence
// diagram: the agent initiates once it sees Active, the admin console answers) and uses
// vanilla/non-trickle ICE - it waits for gathering to complete and sends one offer with every
// local candidate already embedded, then expects exactly one "answer" message back. This keeps
// the signaling protocol over this app's HTTP long-poll relay to the bare minimum (one message
// each way) rather than needing a steady trickle of individual ice-candidate messages in both
// directions, which is fine because ICE gathering here typically completes in well under a
// second (Phase 5's coturn TURN server is always available as a fallback candidate).
func startLiveSession(cfg *chatConfig, session *remoteSessionInfo) error {
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
	remoteSupportLog("started live session %d", session.SessionID)
	return nil
}

// signalPollLoop delivers the single expected "answer" and applies any ice-candidate messages
// that arrive after (harmless if none ever do, since vanilla ICE already embedded every
// candidate this side gathered before sending the offer).
func signalPollLoop(cfg *chatConfig, sessionID int, pc *webrtc.PeerConnection, stop chan struct{}) {
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
