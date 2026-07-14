import "dart:async";
import "package:flutter/material.dart";
import "package:flutter_webrtc/flutter_webrtc.dart";
import "../services/api_client.dart";

enum _LiveStatus { loading, playing, error }

/// Live-view only, same WHEP flow as the web dashboard's LiveViewModal.tsx - creates a
/// recvonly offer, waits for ICE gathering to finish (WHEP expects a complete, non-trickle
/// offer), posts it to the mobile WHEP proxy, and plays back whatever MediaMTX answers with.
/// Nothing is ever recorded or saved on this screen.
class CameraLiveViewScreen extends StatefulWidget {
  final ApiClient apiClient;
  final CameraItem camera;
  const CameraLiveViewScreen({super.key, required this.apiClient, required this.camera});

  @override
  State<CameraLiveViewScreen> createState() => _CameraLiveViewScreenState();
}

class _CameraLiveViewScreenState extends State<CameraLiveViewScreen> {
  final _renderer = RTCVideoRenderer();
  RTCPeerConnection? _pc;
  _LiveStatus _status = _LiveStatus.loading;
  String? _errorMessage;
  bool _disposed = false;

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    try {
      await _renderer.initialize();

      final pc = await createPeerConnection({"iceServers": []});
      _pc = pc;

      await pc.addTransceiver(kind: RTCRtpMediaType.RTCRtpMediaTypeVideo, init: RTCRtpTransceiverInit(direction: TransceiverDirection.RecvOnly));
      await pc.addTransceiver(kind: RTCRtpMediaType.RTCRtpMediaTypeAudio, init: RTCRtpTransceiverInit(direction: TransceiverDirection.RecvOnly));

      pc.onTrack = (RTCTrackEvent event) {
        if (event.track.kind == "video" && event.streams.isNotEmpty) {
          _renderer.srcObject = event.streams[0];
        }
      };

      pc.onConnectionState = (RTCPeerConnectionState state) {
        if (_disposed) return;
        if (state == RTCPeerConnectionState.RTCPeerConnectionStateConnected) {
          setState(() => _status = _LiveStatus.playing);
        } else if (state == RTCPeerConnectionState.RTCPeerConnectionStateFailed ||
            state == RTCPeerConnectionState.RTCPeerConnectionStateClosed) {
          setState(() {
            _status = _LiveStatus.error;
            _errorMessage = "The stream stopped unexpectedly - the camera may be offline.";
          });
        }
      };

      final offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await _waitForIceGatheringComplete(pc);
      if (_disposed) return;

      final localDesc = await pc.getLocalDescription();
      if (localDesc?.sdp == null) throw Exception("Failed to build the connection offer.");

      final answerSdp = await widget.apiClient.sendCameraOffer(widget.camera.id, localDesc!.sdp!);
      if (_disposed) return;

      await pc.setRemoteDescription(RTCSessionDescription(answerSdp, "answer"));
    } catch (e) {
      if (_disposed) return;
      setState(() {
        _status = _LiveStatus.error;
        _errorMessage = e.toString().replaceFirst("ApiException: ", "");
      });
    }
  }

  // Relies solely on the onIceGatheringState callback (rather than also checking the
  // connection's current state up front) to avoid depending on exactly which shape that
  // getter/method takes across flutter_webrtc versions - a short timeout covers the case
  // where gathering was already complete before this listener got attached.
  Future<void> _waitForIceGatheringComplete(RTCPeerConnection pc) async {
    final completer = Completer<void>();
    pc.onIceGatheringState = (state) {
      if (state == RTCIceGatheringState.RTCIceGatheringStateComplete && !completer.isCompleted) {
        completer.complete();
      }
    };
    await completer.future.timeout(const Duration(seconds: 5), onTimeout: () {});
  }

  @override
  void dispose() {
    _disposed = true;
    _pc?.close();
    _pc?.dispose();
    _renderer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(widget.camera.displayName),
      ),
      body: Center(
        child: Stack(
          alignment: Alignment.center,
          children: [
            AspectRatio(
              aspectRatio: 16 / 9,
              child: RTCVideoView(_renderer, objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitContain),
            ),
            if (_status == _LiveStatus.loading)
              const Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(color: Colors.white),
                  SizedBox(height: 12),
                  Text("Connecting to camera...", style: TextStyle(color: Colors.white)),
                ],
              ),
            if (_status == _LiveStatus.error)
              Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  _errorMessage ?? "Couldn't load the live stream.",
                  style: const TextStyle(color: Colors.white),
                  textAlign: TextAlign.center,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
