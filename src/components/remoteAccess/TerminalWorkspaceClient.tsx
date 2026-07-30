"use client";

import { useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

const POLL_INTERVAL_MS = 400;

function TerminalInner({ sessionId }: { sessionId: number }) {
  const toast = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef(0);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    let term: import("@xterm/xterm").Terminal | null = null;
    let fitAddon: import("@xterm/addon-fit").FitAddon | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let disposed = false;

    (async () => {
      // xterm.js touches `window`/`document` at import time - dynamic-imported client-side
      // only, never at module scope, so this component stays safe to import from a page that
      // might ever render server-side.
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      if (disposed || !containerRef.current) return;

      term = new Terminal({
        // Matches this app's one existing terminal-styled convention (ScanTerminal.tsx) -
        // dark background, green-tinted monospace text.
        theme: { background: "#0b0f14", foreground: "#d1f7c4", cursor: "#7ee787" },
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontSize: 13,
        cursorBlink: true,
      });
      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);
      fitAddon.fit();

      term.onData((data) => {
        fetch(`/api/admin/remote-access/sessions/${sessionId}/terminal/input`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        }).catch(() => {});
      });

      const resizeObserver = new ResizeObserver(() => fitAddon?.fit());
      resizeObserver.observe(containerRef.current);

      const poll = async () => {
        try {
          const res = await fetch(`/api/admin/remote-access/sessions/${sessionId}/terminal/output?since=${cursorRef.current}`);
          const data = await res.json();
          if (!res.ok || !data.ok) {
            if (res.status === 404) {
              setClosed(true);
              if (pollTimer) clearInterval(pollTimer);
            }
            return;
          }
          if (data.data.output) term?.write(data.data.output);
          cursorRef.current = data.data.cursor;
          if (data.data.closed) {
            setClosed(true);
            if (pollTimer) clearInterval(pollTimer);
          }
        } catch {
          // transient network hiccup - next poll tries again
        }
      };
      await poll();
      pollTimer = setInterval(poll, POLL_INTERVAL_MS);

      return () => resizeObserver.disconnect();
    })();

    return () => {
      disposed = true;
      if (pollTimer) clearInterval(pollTimer);
      term?.dispose();
    };
  }, [sessionId]);

  async function terminate() {
    if (!confirm("Terminate this session?")) return;
    await fetch(`/api/admin/remote-access/sessions/${sessionId}/terminate`, { method: "POST" });
    setClosed(true);
    toast.show({ type: "success", message: "Session terminated." });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <span style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>Session #{sessionId}{closed && " - closed"}</span>
        <Button size="sm" variant="danger" onClick={terminate} disabled={closed}>
          Disconnect
        </Button>
      </div>
      <div ref={containerRef} style={{ height: 480, background: "#0b0f14", borderRadius: 8, padding: "0.4rem" }} />
    </div>
  );
}

export function TerminalWorkspaceClient({ sessionId }: { sessionId: number }) {
  return (
    <ToastProvider>
      <TerminalInner sessionId={sessionId} />
    </ToastProvider>
  );
}
