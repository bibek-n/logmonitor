"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

const POLL_INTERVAL_MS = 250;
const POINTER_MOVE_THROTTLE_MS = 50;

// Remaps MouseEvent.buttons (bit0=left, bit1=right, bit2=middle) to Guacamole's mouse
// button-mask (bit0=left, bit1=middle, bit2=right) - identical bit layout to VncViewerClient's
// toRfbButtonMask, kept as its own copy here since it's a 3-line pure function, not worth a
// shared module for.
function toGuacButtonMask(browserButtons: number): number {
  return (browserButtons & 1) | (browserButtons & 4 ? 2 : 0) | (browserButtons & 2 ? 4 : 0);
}

function RdpInner({ sessionId, width: initialWidth, height: initialHeight }: { sessionId: number; width: number; height: number }) {
  const toast = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameSeqRef = useRef(0);
  const lastPointerSentAt = useRef(0);
  const dimsRef = useRef({ width: initialWidth, height: initialHeight });
  const [dims, setDims] = useState({ width: initialWidth, height: initialHeight });
  const [closed, setClosed] = useState(false);
  const [connecting, setConnecting] = useState(true);

  useEffect(() => {
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;

    const poll = async () => {
      if (disposed) return;
      try {
        const res = await fetch(`/api/admin/remote-access/sessions/${sessionId}/rdp/frame?since=${frameSeqRef.current}`);
        const data = await res.json();
        if (!res.ok || !data.ok) {
          if (res.status === 404) setClosed(true);
          else pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }
        frameSeqRef.current = data.data.frameSeq;
        // RDP's resolution can change after connect (resize-method: display-update) unlike
        // VNC's fixed-for-the-session framebuffer, so track whatever guacd last reported.
        if (data.data.width !== dimsRef.current.width || data.data.height !== dimsRef.current.height) {
          dimsRef.current = { width: data.data.width, height: data.data.height };
          setDims(dimsRef.current);
        }
        if (data.data.image && ctx) {
          setConnecting(false);
          const img = new Image();
          img.onload = () => ctx.drawImage(img, 0, 0, dimsRef.current.width, dimsRef.current.height);
          img.src = data.data.image;
        }
        if (data.data.closed) {
          setClosed(true);
          return;
        }
      } catch {
        // transient network hiccup - next poll tries again
      }
      if (!disposed) pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
    };
    void poll();

    return () => {
      disposed = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [sessionId]);

  function canvasToRemoteCoords(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * dims.width;
    const y = ((e.clientY - rect.top) / rect.height) * dims.height;
    return { x, y };
  }

  function sendPointer(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = canvasToRemoteCoords(e);
    fetch(`/api/admin/remote-access/sessions/${sessionId}/rdp/pointer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x, y, buttons: toGuacButtonMask(e.buttons) }),
    }).catch(() => {});
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const now = Date.now();
    if (now - lastPointerSentAt.current < POINTER_MOVE_THROTTLE_MS) return;
    lastPointerSentAt.current = now;
    sendPointer(e);
  }

  function onKey(e: React.KeyboardEvent<HTMLDivElement>, down: boolean) {
    // Prevent the browser from acting on these (scrolling, navigating back, losing focus) -
    // they're meant for the remote system, not this page.
    if (["Tab", "Backspace", " ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
    }
    fetch(`/api/admin/remote-access/sessions/${sessionId}/rdp/key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: e.key, down }),
    }).catch(() => {});
  }

  async function disconnect() {
    await fetch(`/api/admin/remote-access/sessions/${sessionId}/rdp/end`, { method: "POST" });
    setClosed(true);
    toast.show({ type: "success", message: "RDP session disconnected." });
  }

  // Same browser limitation as the VNC viewer (see VncViewerClient's sendCtrlAltDel comment):
  // the real Ctrl+Alt+Del combo never reaches page JS, so this sends the equivalent key down/up
  // sequence over the Guacamole protocol instead - guacd's RDP client forwards it to the remote
  // session the same way a physical keypress would.
  async function sendCtrlAltDel() {
    const press = (key: string, down: boolean) =>
      fetch(`/api/admin/remote-access/sessions/${sessionId}/rdp/key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, down }),
      }).catch(() => {});
    await press("Control", true);
    await press("Alt", true);
    await press("Delete", true);
    await press("Delete", false);
    await press("Alt", false);
    await press("Control", false);
    toast.show({ type: "success", message: "Sent Ctrl+Alt+Del." });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <span style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>
          Session #{sessionId} ({dims.width}x{dims.height}){closed && " - closed"}{connecting && !closed && " - connecting..."}
        </span>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <Button size="sm" variant="secondary" onClick={sendCtrlAltDel} disabled={closed}>
            Send Ctrl+Alt+Del
          </Button>
          <Button size="sm" variant="danger" onClick={disconnect} disabled={closed}>
            Disconnect
          </Button>
        </div>
      </div>
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={(e) => onKey(e, true)}
        onKeyUp={(e) => onKey(e, false)}
        style={{ outline: "none", background: "#0b0f14", borderRadius: 8, padding: "0.4rem", display: "block" }}
      >
        <canvas
          ref={canvasRef}
          width={dims.width}
          height={dims.height}
          onMouseDown={sendPointer}
          onMouseUp={sendPointer}
          onMouseMove={onMouseMove}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            // Same three-way cap as the VNC viewer (container width, 1400px, viewport height
            // budget) so this never forces a page scrollbar - see VncViewerClient for the full
            // reasoning on each term.
            width: `min(100%, 1400px, calc((100vh - 260px) * ${dims.width} / ${dims.height}))`,
            height: "auto",
            cursor: "default",
            display: "block",
          }}
        />
      </div>
      <p style={{ fontSize: "0.72rem", color: "var(--ink-muted)", marginTop: "0.4rem" }}>
        Click the screen to focus it before typing. Frames refresh a few times per second, not a continuous video stream.
      </p>
    </div>
  );
}

export function RdpViewerClient({ sessionId, width, height }: { sessionId: number; width: number; height: number }) {
  return (
    <ToastProvider>
      <RdpInner sessionId={sessionId} width={width} height={height} />
    </ToastProvider>
  );
}
