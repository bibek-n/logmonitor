"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

const POLL_INTERVAL_MS = 250;
const POINTER_MOVE_THROTTLE_MS = 50;

// Remaps MouseEvent.buttons (bit0=left, bit1=right, bit2=middle) to RFB's PointerEvent
// button-mask (bit0=left, bit1=middle, bit2=right) - the two put middle/right in opposite bits.
function toRfbButtonMask(browserButtons: number): number {
  return (browserButtons & 1) | (browserButtons & 4 ? 2 : 0) | (browserButtons & 2 ? 4 : 0);
}

function VncInner({ sessionId, width, height }: { sessionId: number; width: number; height: number }) {
  const toast = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameSeqRef = useRef(0);
  const lastPointerSentAt = useRef(0);
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
        const res = await fetch(`/api/admin/remote-access/sessions/${sessionId}/vnc/frame?since=${frameSeqRef.current}`);
        const data = await res.json();
        if (!res.ok || !data.ok) {
          if (res.status === 404) setClosed(true);
          else pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }
        frameSeqRef.current = data.data.frameSeq;
        if (data.data.image && ctx) {
          setConnecting(false);
          const img = new Image();
          img.onload = () => ctx.drawImage(img, 0, 0, width, height);
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
  }, [sessionId, width, height]);

  function canvasToRemoteCoords(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    const y = ((e.clientY - rect.top) / rect.height) * height;
    return { x, y };
  }

  function sendPointer(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = canvasToRemoteCoords(e);
    fetch(`/api/admin/remote-access/sessions/${sessionId}/vnc/pointer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x, y, buttons: toRfbButtonMask(e.buttons) }),
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
    fetch(`/api/admin/remote-access/sessions/${sessionId}/vnc/key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: e.key, down }),
    }).catch(() => {});
  }

  async function disconnect() {
    await fetch(`/api/admin/remote-access/sessions/${sessionId}/vnc/end`, { method: "POST" });
    setClosed(true);
    toast.show({ type: "success", message: "VNC session disconnected." });
  }

  // Browsers intercept the real Ctrl+Alt+Del combo before any page's JS ever sees it (an OS-level
  // security measure, not something fixable here), so a locked Windows screen needs this sent as
  // ordinary RFB key events instead - a VNC server running as a Windows service (as ours does,
  // see TightVNC's SERVER_REGISTER_AS_SERVICE) recognizes that exact down/up sequence and relays
  // it to the secure desktop the same way a real keyboard press would. Requests are awaited in
  // series (not fired in parallel) because sendVncKey writes straight to the RFB socket in call
  // order - out-of-order delivery would send a nonsense chord instead of Ctrl+Alt+Del.
  async function sendCtrlAltDel() {
    const press = (key: string, down: boolean) =>
      fetch(`/api/admin/remote-access/sessions/${sessionId}/vnc/key`, {
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
          Session #{sessionId} ({width}x{height}){closed && " - closed"}{connecting && !closed && " - connecting..."}
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
          width={width}
          height={height}
          onMouseDown={sendPointer}
          onMouseUp={sendPointer}
          onMouseMove={onMouseMove}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            // Capped three ways at once so it grows to fill the panel without ever forcing a
            // page scrollbar: no wider than the container, no wider than 1400px, and no taller
            // than the viewport leaves room for (260px reserved for the header/toolbar above
            // it) - that last term converts a max *height* budget into the equivalent max
            // *width* via the fixed w/h aspect ratio, since height stays "auto".
            width: `min(100%, 1400px, calc((100vh - 260px) * ${width} / ${height}))`,
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

export function VncViewerClient({ sessionId, width, height }: { sessionId: number; width: number; height: number }) {
  return (
    <ToastProvider>
      <VncInner sessionId={sessionId} width={width} height={height} />
    </ToastProvider>
  );
}
