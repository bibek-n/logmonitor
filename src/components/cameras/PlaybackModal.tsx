"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2, ZoomIn, ZoomOut, Maximize2, Calendar } from "lucide-react";

interface PlaybackModalProps {
  cameraId: number;
  channelName: string;
  onClose: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.4;

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clampPan(pan: { x: number; y: number }, zoom: number): { x: number; y: number } {
  const maxOffsetPct = ((zoom - 1) / zoom) * 50;
  return {
    x: Math.max(-maxOffsetPct, Math.min(maxOffsetPct, pan.x)),
    y: Math.max(-maxOffsetPct, Math.min(maxOffsetPct, pan.y)),
  };
}

function todayLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// Browses and plays back recorded footage from the NVR - a separate flow from
// LiveViewModal (recordings need a date/time range picked first, and the resulting stream
// comes from a temporary, session-specific MediaMTX path rather than the fixed live
// channel path - see /api/admin/nvr/cameras/[cameraId]/playback/route.ts). Note: the exact
// time-window accuracy of what plays back hasn't been visually verified against real
// recorded footage - if the video starts at the wrong point, that's the area to revisit
// first (see playbackRtspUrlFor in src/lib/nvr.ts).
export function PlaybackModal({ cameraId, channelName, onClose }: PlaybackModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [date, setDate] = useState(todayLocalDate());
  const [startTime, setStartTime] = useState("00:00");
  const [durationMinutes, setDurationMinutes] = useState(10);

  const [pathName, setPathName] = useState<string | null>(null);
  const [phase, setPhase] = useState<"picking" | "connecting" | "playing" | "error">("picking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gesture = useRef<{ mode: "none" | "pan" | "pinch"; startPan: { x: number; y: number }; startX: number; startY: number; startDist: number; startZoom: number }>({
    mode: "none",
    startPan: { x: 0, y: 0 },
    startX: 0,
    startY: 0,
    startDist: 0,
    startZoom: 1,
  });

  function setZoomClamped(next: number) {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    setZoom(clamped);
    if (clamped === MIN_ZOOM) setPan({ x: 0, y: 0 });
    else setPan((p) => clampPan(p, clamped));
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    setZoomClamped(zoom + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
  }

  function resetZoom() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function handlePointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.current.size === 2) {
      const pts = [...activePointers.current.values()];
      gesture.current = { mode: "pinch", startPan: pan, startX: 0, startY: 0, startDist: dist(pts[0], pts[1]), startZoom: zoom };
    } else if (activePointers.current.size === 1 && zoom > MIN_ZOOM) {
      gesture.current = { mode: "pan", startPan: pan, startX: e.clientX, startY: e.clientY, startDist: 0, startZoom: zoom };
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (g.mode === "pan" && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dxPct = ((e.clientX - g.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - g.startY) / rect.height) * 100;
      setPan(clampPan({ x: g.startPan.x + dxPct, y: g.startPan.y + dyPct }, zoom));
    } else if (g.mode === "pinch" && activePointers.current.size === 2) {
      const pts = [...activePointers.current.values()];
      const scale = dist(pts[0], pts[1]) / (g.startDist || 1);
      setZoomClamped(g.startZoom * scale);
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size === 0) {
      gesture.current = { ...gesture.current, mode: "none" };
    } else if (activePointers.current.size === 1) {
      const [, pt] = [...activePointers.current.entries()][0];
      gesture.current = zoom > MIN_ZOOM
        ? { mode: "pan", startPan: pan, startX: pt.x, startY: pt.y, startDist: 0, startZoom: zoom }
        : { ...gesture.current, mode: "none" };
    }
  }

  async function loadRecording() {
    setPhase("connecting");
    setErrorMessage(null);
    resetZoom();

    const [h, m] = startTime.split(":").map(Number);
    const start = new Date(`${date}T00:00:00`);
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    try {
      const res = await fetch(`/api/admin/nvr/cameras/${cameraId}/playback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startTime: start.toISOString(), endTime: end.toISOString() }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Failed to start playback");
      setPathName(data.pathName);
    } catch (err) {
      setPhase("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to start playback");
    }
  }

  async function stopPlayback() {
    if (!pathName) return;
    const p = pathName;
    setPathName(null);
    setPhase("picking");
    try {
      await fetch(`/api/admin/nvr/cameras/${cameraId}/playback`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathName: p }),
      });
    } catch {
      // best-effort cleanup - not worth surfacing an error for
    }
  }

  useEffect(() => {
    if (!pathName) return;
    const activePathName = pathName;
    let cancelled = false;
    let pc: RTCPeerConnection | null = null;

    async function start() {
      const video = videoRef.current;
      if (!video) return;

      pc = new RTCPeerConnection();
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      const remoteStream = new MediaStream();
      video.srcObject = remoteStream;
      pc.ontrack = (event) => remoteStream.addTrack(event.track);

      pc.onconnectionstatechange = () => {
        if (cancelled || !pc) return;
        if (pc.connectionState === "connected") setPhase("playing");
        else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          setPhase("error");
          setErrorMessage("No recording found for that time range, or the stream stopped.");
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await new Promise<void>((resolve) => {
        if (pc!.iceGatheringState === "complete") {
          resolve();
          return;
        }
        const check = () => {
          if (pc!.iceGatheringState === "complete") {
            pc!.removeEventListener("icegatheringstatechange", check);
            resolve();
          }
        };
        pc!.addEventListener("icegatheringstatechange", check);
        setTimeout(resolve, 5000);
      });

      if (cancelled || !pc || !pc.localDescription) return;

      const res = await fetch(`/api/admin/nvr/cameras/${cameraId}/playback/webrtc?path=${encodeURIComponent(activePathName)}`, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription.sdp,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to load the recording" }));
        throw new Error(body.error ?? "Failed to load the recording");
      }

      const answerSdp = await res.text();
      if (cancelled || !pc) return;
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    }

    start().catch((err) => {
      if (cancelled) return;
      setPhase("error");
      setErrorMessage(err instanceof Error ? err.message : "Couldn't load the recording.");
    });

    return () => {
      cancelled = true;
      pc?.close();
    };
  }, [pathName, cameraId]);

  useEffect(() => {
    return () => {
      if (pathName) {
        fetch(`/api/admin/nvr/cameras/${cameraId}/playback`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pathName }),
          keepalive: true,
        }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem",
      }}
      onClick={onClose}
    >
      <div style={{ maxWidth: 960, width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between" style={{ marginBottom: "0.75rem" }}>
          <div style={{ color: "#fff", fontWeight: 600, fontSize: "0.95rem" }}>{channelName} - Playback</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: "0.25rem" }} aria-label="Close">
            <X size={22} />
          </button>
        </div>

        <div
          className="flex items-end gap-2 flex-wrap"
          style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "0.75rem", marginBottom: "0.75rem" }}
        >
          <div className="flex flex-col gap-1">
            <label style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.7)" }}>Date</label>
            <input
              type="date"
              value={date}
              max={todayLocalDate()}
              onChange={(e) => setDate(e.target.value)}
              style={{ padding: "0.4rem 0.5rem", borderRadius: 6, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.4)", color: "#fff", fontSize: "0.82rem" }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.7)" }}>Start time</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={{ padding: "0.4rem 0.5rem", borderRadius: 6, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.4)", color: "#fff", fontSize: "0.82rem" }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.7)" }}>Duration</label>
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              style={{ padding: "0.4rem 0.5rem", borderRadius: 6, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.4)", color: "#fff", fontSize: "0.82rem" }}
            >
              <option value={5}>5 min</option>
              <option value={10}>10 min</option>
              <option value={30}>30 min</option>
              <option value={60}>1 hour</option>
            </select>
          </div>
          <button
            onClick={pathName ? stopPlayback : loadRecording}
            disabled={phase === "connecting"}
            className="submit"
            style={{ width: "auto", marginTop: 0, padding: "0.45rem 1rem", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <Calendar size={14} />
            {phase === "connecting" ? "Loading..." : pathName ? "Stop" : "Play recording"}
          </button>
        </div>

        <div
          ref={containerRef}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={resetZoom}
          style={{
            position: "relative", aspectRatio: "16 / 9", background: "#000", borderRadius: 8, overflow: "hidden",
            touchAction: "none", cursor: zoom > MIN_ZOOM ? "grab" : "default",
          }}
        >
          <video
            ref={videoRef}
            controls
            autoPlay
            muted
            style={{
              width: "100%", height: "100%",
              transform: `scale(${zoom}) translate(${pan.x}%, ${pan.y}%)`,
              transformOrigin: "center center",
              transition: gesture.current.mode === "none" ? "transform 0.12s ease-out" : "none",
            }}
          />

          {phase === "playing" && (
            <div style={{ position: "absolute", top: 12, right: 12, display: "flex", flexDirection: "column", gap: "0.35rem", zIndex: 2 }}>
              <button
                onClick={() => setZoomClamped(zoom + ZOOM_STEP)}
                disabled={zoom >= MAX_ZOOM}
                aria-label="Zoom in"
                style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.55)", color: "#fff", cursor: zoom >= MAX_ZOOM ? "default" : "pointer", opacity: zoom >= MAX_ZOOM ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <ZoomIn size={16} />
              </button>
              <button
                onClick={() => setZoomClamped(zoom - ZOOM_STEP)}
                disabled={zoom <= MIN_ZOOM}
                aria-label="Zoom out"
                style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.55)", color: "#fff", cursor: zoom <= MIN_ZOOM ? "default" : "pointer", opacity: zoom <= MIN_ZOOM ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <ZoomOut size={16} />
              </button>
              {zoom > MIN_ZOOM && (
                <button
                  onClick={resetZoom}
                  aria-label="Reset zoom"
                  title="Reset zoom"
                  style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.55)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <Maximize2 size={14} />
                </button>
              )}
            </div>
          )}

          {phase === "picking" && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.6)", fontSize: "0.85rem", textAlign: "center", padding: "1rem" }}>
              Pick a date, start time, and duration above, then press Play recording.
            </div>
          )}
          {phase === "connecting" && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", gap: "0.5rem" }}>
              <Loader2 size={28} style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: "0.85rem" }}>Loading recording...</span>
            </div>
          )}
          {phase === "error" && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "0.85rem", padding: "1rem", textAlign: "center" }}>
              {errorMessage ?? "Couldn't load the recording."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
