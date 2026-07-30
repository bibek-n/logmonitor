"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Radio, ShieldAlert, ShieldCheck, X, Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

type SessionStatus = "Pending" | "Approved" | "Rejected" | "Active" | "Ended" | "Expired";

interface SessionInfo {
  sessionId: number;
  deviceId: string;
  reason: string;
  status: SessionStatus;
  permissionsGranted: string;
  terminationReason: string | null;
  iceServers?: RTCIceServer[];
}

const POLL_MS = 2000;
const SIGNAL_POLL_MS = 1500;

function hasPermission(granted: string, want: string): boolean {
  return granted.split(",").map((p) => p.trim()).includes(want);
}

// object-fit: contain means the video element's own box can be bigger than the actual pixels
// being shown (letterboxing) - mapping a click straight off getBoundingClientRect would send
// coordinates that drift from what the employee's screen actually shows. This computes the
// real displayed-content rectangle so mouse fractions line up with SendInput's expectations on
// the agent side (see remotesupport_input_windows.go's moveMouseAbsolute).
function videoContentRect(video: HTMLVideoElement) {
  const rect = video.getBoundingClientRect();
  const vw = video.videoWidth || 16;
  const vh = video.videoHeight || 9;
  const boxAR = rect.width / rect.height;
  const videoAR = vw / vh;
  let width = rect.width;
  let height = rect.height;
  let offsetX = 0;
  let offsetY = 0;
  if (videoAR > boxAR) {
    height = rect.width / videoAR;
    offsetY = (rect.height - height) / 2;
  } else {
    width = rect.height * videoAR;
    offsetX = (rect.width - width) / 2;
  }
  return { left: rect.left + offsetX, top: rect.top + offsetY, width, height };
}

function pointerFraction(e: { clientX: number; clientY: number }, video: HTMLVideoElement) {
  const r = videoContentRect(video);
  const x = r.width > 0 ? (e.clientX - r.left) / r.width : 0;
  const y = r.height > 0 ? (e.clientY - r.top) / r.height : 0;
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}

const MOUSE_BUTTON_NAME = ["left", "middle", "right"] as const;

function RemoteSupportSessionViewerInner({ sessionId }: { sessionId: number }) {
  const router = useRouter();
  const toast = useToast();

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [ending, setEnding] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [focused, setFocused] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const peerStartedRef = useRef(false);
  const signalPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canControlRef = useRef(false);

  function teardownPeer() {
    if (signalPollRef.current) {
      clearInterval(signalPollRef.current);
      signalPollRef.current = null;
    }
    dataChannelRef.current = null;
    canControlRef.current = false;
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    peerStartedRef.current = false;
    setConnectionState("new");
  }

  async function fetchSignalMessages(): Promise<{ id: number; messageType: string; payload: string }[]> {
    const res = await fetch(`/api/admin/remote-support/sessions/${sessionId}/signal`);
    const data = await res.json();
    if (!data.ok) return [];
    return data.messages ?? [];
  }

  async function postSignalMessage(type: string, payload: string) {
    await fetch(`/api/admin/remote-support/sessions/${sessionId}/signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload }),
    });
  }

  // The agent is the OFFERER and uses vanilla (non-trickle) ICE - it waits for its own
  // gathering to finish before sending one "offer" with every candidate already embedded (see
  // remotesupport_capture_windows.go). Mirroring that here keeps the whole exchange to exactly
  // two signaling messages: this function answers once, then only reacts to a stray
  // ice-candidate message if one ever arrives.
  function startPeerConnection(info: SessionInfo) {
    if (peerStartedRef.current) return;
    peerStartedRef.current = true;

    const pc = new RTCPeerConnection({ iceServers: info.iceServers ?? [] });
    pcRef.current = pc;
    canControlRef.current = hasPermission(info.permissionsGranted, "control");

    pc.onconnectionstatechange = () => setConnectionState(pc.connectionState);

    pc.ontrack = (event) => {
      if (videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
      }
    };

    pc.ondatachannel = (event) => {
      dataChannelRef.current = event.channel;
    };

    let answered = false;
    signalPollRef.current = setInterval(async () => {
      const messages = await fetchSignalMessages();
      for (const m of messages) {
        if (m.messageType === "offer" && !answered) {
          try {
            await pc.setRemoteDescription({ type: "offer", sdp: m.payload });
            const answer = await pc.createAnswer();
            const gatherComplete = new Promise<void>((resolve) => {
              if (pc.iceGatheringState === "complete") {
                resolve();
                return;
              }
              const check = () => {
                if (pc.iceGatheringState === "complete") {
                  pc.removeEventListener("icegatheringstatechange", check);
                  resolve();
                }
              };
              pc.addEventListener("icegatheringstatechange", check);
            });
            await pc.setLocalDescription(answer);
            await gatherComplete;
            if (pc.localDescription) {
              await postSignalMessage("answer", pc.localDescription.sdp);
              answered = true;
            }
          } catch (err) {
            remoteSupportViewerLog("failed to answer offer", err);
          }
        } else if (m.messageType === "ice-candidate") {
          try {
            await pc.addIceCandidate(JSON.parse(m.payload));
          } catch {
            // ignore malformed/late candidates - non-trickle offer already carries everything needed
          }
        }
      }
    }, SIGNAL_POLL_MS);
  }

  function remoteSupportViewerLog(...args: unknown[]) {
    // eslint-disable-next-line no-console
    console.warn("[remote-support]", ...args);
  }

  async function poll() {
    try {
      const res = await fetch(`/api/admin/remote-support/sessions/${sessionId}`);
      const data = await res.json();
      if (!data.ok || !data.session) {
        setNotFound(true);
        return;
      }
      setSession(data.session);
      if (data.session.status === "Active") {
        startPeerConnection(data.session);
      } else if (peerStartedRef.current) {
        teardownPeer();
      }
    } catch {
      // transient poll failure - try again next tick
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      clearInterval(interval);
      teardownPeer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  function sendInputEvent(payload: Record<string, unknown>) {
    if (!canControlRef.current) return;
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") return;
    channel.send(JSON.stringify(payload));
  }

  function onVideoPointerMove(e: React.MouseEvent<HTMLVideoElement>) {
    if (!videoRef.current) return;
    const { x, y } = pointerFraction(e, videoRef.current);
    sendInputEvent({ type: "mousemove", x, y });
  }

  function onVideoMouseDown(e: React.MouseEvent<HTMLVideoElement>) {
    sendInputEvent({ type: "mousedown", button: MOUSE_BUTTON_NAME[e.button] ?? "left" });
  }

  function onVideoMouseUp(e: React.MouseEvent<HTMLVideoElement>) {
    sendInputEvent({ type: "mouseup", button: MOUSE_BUTTON_NAME[e.button] ?? "left" });
  }

  // deltaY is positive when scrolling toward the user (down) in the DOM; Win32's WHEEL_DELTA
  // convention is the opposite sign (positive = away from the user / scroll up), so this flips
  // it. /100 approximates one wheel "notch" for the common DOM_DELTA_PIXEL case most browsers
  // report on a standard mouse.
  function onVideoWheel(e: React.WheelEvent<HTMLVideoElement>) {
    e.preventDefault();
    sendInputEvent({ type: "wheel", delta: -(e.deltaY / 100) });
  }

  function onContainerKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    e.preventDefault();
    sendInputEvent({ type: "keydown", key: e.code });
  }

  function onContainerKeyUp(e: React.KeyboardEvent<HTMLDivElement>) {
    e.preventDefault();
    sendInputEvent({ type: "keyup", key: e.code });
  }

  async function endSession() {
    setEnding(true);
    try {
      const res = await fetch(`/api/admin/remote-support/sessions/${sessionId}/end`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to end the session");
      toast.show({ type: "success", message: "Session ended." });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setEnding(false);
    }
  }

  async function cancelRequest() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/admin/remote-support/requests/${sessionId}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to cancel the request");
      toast.show({ type: "info", message: "Request cancelled." });
      router.push("/dashboard/remote-support");
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return <p style={{ color: "var(--ink-muted)", marginTop: "1rem" }}>Loading session...</p>;
  }
  if (notFound || !session) {
    return <p style={{ color: "var(--danger)", marginTop: "1rem" }}>Session not found, or you don&apos;t have access to it.</p>;
  }

  const canControl = hasPermission(session.permissionsGranted, "control");

  return (
    <div style={{ marginTop: "1rem" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.75rem" }}>
        <div>
          <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.2rem" }}>Session #{session.sessionId}</h1>
          <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem", margin: 0 }}>
            {session.deviceId} — {session.reason}
          </p>
        </div>
        <StatusBadge status={session.status} />
      </div>

      {session.status === "Pending" && (
        <Card>
          <div className="flex items-center gap-3">
            <Clock size={20} style={{ color: "var(--warning)" }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "0.9rem" }}>Waiting for the employee to approve this request...</p>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "var(--ink-muted)" }}>
                Requests expire automatically after a short window if not answered.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={cancelRequest} disabled={cancelling}>
              {cancelling ? "Cancelling..." : "Cancel Request"}
            </Button>
          </div>
        </Card>
      )}

      {(session.status === "Rejected" || session.status === "Expired") && (
        <Card>
          <div className="flex items-center gap-3">
            <ShieldAlert size={20} style={{ color: "var(--danger)" }} />
            <p style={{ margin: 0, fontSize: "0.9rem" }}>
              {session.status === "Rejected" ? "The employee declined this request." : "This request expired before it was answered."}
            </p>
          </div>
        </Card>
      )}

      {session.status === "Ended" && (
        <Card>
          <div className="flex items-center gap-3">
            <ShieldCheck size={20} style={{ color: "var(--ink-muted)" }} />
            <p style={{ margin: 0, fontSize: "0.9rem" }}>Session ended{session.terminationReason ? ` (${session.terminationReason})` : ""}.</p>
          </div>
        </Card>
      )}

      {session.status === "Active" && (
        <>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div
              ref={containerRef}
              tabIndex={0}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={onContainerKeyDown}
              onKeyUp={onContainerKeyUp}
              style={{
                position: "relative",
                outline: "none",
                boxShadow: focused && canControl ? "inset 0 0 0 2px var(--primary)" : "none",
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onMouseMove={canControl ? onVideoPointerMove : undefined}
                onMouseDown={canControl ? onVideoMouseDown : undefined}
                onMouseUp={canControl ? onVideoMouseUp : undefined}
                onWheel={canControl ? onVideoWheel : undefined}
                onContextMenu={(e) => canControl && e.preventDefault()}
                onClick={() => containerRef.current?.focus()}
                style={{ width: "100%", display: "block", background: "#000", cursor: canControl ? "crosshair" : "default" }}
              />
              {connectionState !== "connected" && (
                <div
                  className="flex items-center justify-center"
                  style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: "0.85rem" }}
                >
                  Connecting to {session.deviceId}... ({connectionState})
                </div>
              )}
              {connectionState === "connected" && canControl && !focused && (
                <div
                  className="flex items-center justify-center"
                  style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", color: "#fff", fontSize: "0.85rem" }}
                >
                  Click to control keyboard and mouse
                </div>
              )}
            </div>
          </Card>

          <div className="flex items-center justify-between" style={{ marginTop: "0.75rem" }}>
            <div className="flex items-center gap-2" style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>
              <Radio size={14} style={{ color: "var(--danger)" }} />
              {canControl ? "View + control" : "View only"} — permissions: {session.permissionsGranted}
            </div>
            <Button variant="danger" onClick={endSession} disabled={ending}>
              <X size={14} /> {ending ? "Ending..." : "End Session"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const tone =
    status === "Active" ? "success" : status === "Pending" ? "warning" : status === "Ended" ? "neutral" : "danger";
  return <Badge tone={tone}>{status}</Badge>;
}

export function RemoteSupportSessionViewer({ sessionId }: { sessionId: number }) {
  return (
    <ToastProvider>
      <RemoteSupportSessionViewerInner sessionId={sessionId} />
    </ToastProvider>
  );
}
