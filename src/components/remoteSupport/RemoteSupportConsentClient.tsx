"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, ShieldAlert, Radio, X } from "lucide-react";

interface PendingSession {
  sessionId: number;
  adminName: string;
  reason: string;
  expiresAt: string;
  nonce: string;
  permissionsRequested: string;
}

function describePermissions(permissionsGranted: string | undefined): string {
  const perms = (permissionsGranted ?? "view").split(",").map((p) => p.trim());
  return perms.includes("control") ? "view and control your screen" : "view your screen";
}

type LiveStatus = "Pending" | "Approved" | "Active" | "Ended" | "Rejected" | "Expired";

const POLL_MS = 2000;

function secondsUntil(iso: string): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));
}

// This page is the ONE place the whole Remote Support consent/active-session UI lives - see
// the Phase 3 design note: chattray (the Go tray companion) has no native dialog code of its
// own, it launches this page in a real browser window (same as the existing chat feature) and
// the actual live screen-share/input session runs natively in chattray itself, entirely
// independent of this tab staying open. This page only ever needs to show consent + a status/
// End button - it never touches the video/input stream.
export default function RemoteSupportConsentClient({
  deviceId,
  token,
  staffName,
}: {
  deviceId: string;
  token: string;
  staffName: string;
}) {
  const [pending, setPending] = useState<PendingSession | null>(null);
  const [status, setStatus] = useState<LiveStatus | "Idle">("Idle");
  const [responding, setResponding] = useState<"approve" | "reject" | null>(null);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionIdRef = useRef<number | null>(null);

  const base = `/api/agent/remote-support/chat`;
  const qs = `deviceId=${encodeURIComponent(deviceId)}&token=${encodeURIComponent(token)}`;

  async function poll() {
    try {
      // Once we know about a session (pending or later), track it via /session, which
      // reports every state (Pending/Active/Ended/...) - /pending only ever reports Pending
      // rows, so it goes quiet the moment an admin's request is answered either way.
      if (sessionIdRef.current === null) {
        const res = await fetch(`${base}/pending?${qs}`);
        const data = await res.json();
        if (data.ok && data.session) {
          sessionIdRef.current = data.session.sessionId;
          setPending(data.session);
          setStatus("Pending");
        }
      } else {
        const res = await fetch(`${base}/session?${qs}`);
        const data = await res.json();
        if (data.ok && data.session) {
          setStatus(data.session.status);
          if (data.session.status !== "Pending") setPending((p) => p); // keep last-known reason/adminName for display
        }
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
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function respond(approved: boolean) {
    if (!pending) return;
    setResponding(approved ? "approve" : "reject");
    setError(null);
    try {
      const res = await fetch(`${base}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, token, sessionId: pending.sessionId, nonce: pending.nonce, approved }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong - please try again.");
        return;
      }
      setStatus(data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong - please try again.");
    } finally {
      setResponding(null);
    }
  }

  async function endSession() {
    if (sessionIdRef.current === null) return;
    setEnding(true);
    try {
      await fetch(`${base}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, token, sessionId: sessionIdRef.current, reason: "EmployeeEnded" }),
      });
      setStatus("Ended");
    } finally {
      setEnding(false);
    }
  }

  const wrapperStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    padding: "2rem",
    textAlign: "center",
    background: "var(--bg)",
    color: "var(--ink)",
    gap: "1.1rem",
  };

  if (loading) {
    return (
      <div style={wrapperStyle}>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.9rem" }}>Checking for a support request...</p>
      </div>
    );
  }

  if (status === "Idle") {
    return (
      <div style={wrapperStyle}>
        <ShieldCheck size={40} style={{ color: "var(--ink-muted)" }} />
        <div>
          <h1 style={{ fontSize: "1.05rem", margin: "0 0 0.4rem" }}>No support request right now</h1>
          <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem", margin: 0 }}>
            This page will show a request the moment IT asks to connect to your screen.
          </p>
        </div>
      </div>
    );
  }

  if (status === "Pending" && pending) {
    const seconds = secondsUntil(pending.expiresAt);
    return (
      <div style={wrapperStyle}>
        <ShieldAlert size={44} style={{ color: "var(--warning)" }} />
        <div style={{ maxWidth: 380 }}>
          <h1 style={{ fontSize: "1.15rem", margin: "0 0 0.5rem" }}>Remote support request</h1>
          <p style={{ margin: "0 0 0.9rem", fontSize: "0.92rem" }}>
            <strong>{pending.adminName}</strong> wants to {describePermissions(pending.permissionsRequested)} to help with:
          </p>
          <p
            style={{
              margin: "0 0 1.1rem",
              padding: "0.7rem 0.9rem",
              borderRadius: 10,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              fontSize: "0.88rem",
              textAlign: "left",
            }}
          >
            {pending.reason}
          </p>
          <p style={{ fontSize: "0.76rem", color: "var(--ink-muted)", margin: "0 0 1.1rem" }}>
            Nothing is shared until you approve. This request expires in {seconds}s.
          </p>
          {error && (
            <p style={{ color: "var(--danger)", fontSize: "0.82rem", margin: "0 0 0.8rem" }}>{error}</p>
          )}
          <div style={{ display: "flex", gap: "0.6rem", justifyContent: "center" }}>
            <button
              onClick={() => respond(false)}
              disabled={responding !== null}
              style={{
                padding: "0.6rem 1.3rem",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--ink)",
                fontSize: "0.88rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {responding === "reject" ? "Declining..." : "Decline"}
            </button>
            <button
              onClick={() => respond(true)}
              disabled={responding !== null}
              style={{
                padding: "0.6rem 1.3rem",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, var(--primary), var(--info))",
                color: "#fff",
                fontSize: "0.88rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {responding === "approve" ? "Approving..." : "Approve"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "Active") {
    return (
      <div style={wrapperStyle}>
        <div style={{ position: "relative" }}>
          <Radio size={44} style={{ color: "var(--danger)" }} />
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "var(--danger)",
              animation: "remoteSupportPulse 1.4s ease-in-out infinite",
            }}
          />
        </div>
        <div>
          <h1 style={{ fontSize: "1.1rem", margin: "0 0 0.4rem" }}>Remote support is active</h1>
          <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem", margin: 0, maxWidth: 340 }}>
            {pending?.adminName ?? "IT"} can currently see and control your screen. You can end this at any time.
          </p>
        </div>
        <button
          onClick={endSession}
          disabled={ending}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.7rem 1.4rem",
            borderRadius: 10,
            border: "none",
            background: "var(--danger)",
            color: "#fff",
            fontSize: "0.9rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <X size={16} />
          {ending ? "Ending..." : "End Session"}
        </button>
        <style>{`
          @keyframes remoteSupportPulse {
            0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--danger) 55%, transparent); }
            50% { box-shadow: 0 0 0 6px transparent; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={wrapperStyle}>
      <ShieldCheck size={40} style={{ color: "var(--success)" }} />
      <div>
        <h1 style={{ fontSize: "1.05rem", margin: "0 0 0.4rem" }}>
          {status === "Rejected" ? "Request declined" : "Session ended"}
        </h1>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem", margin: 0 }}>
          Signed in as {staffName}. You can close this window.
        </p>
      </div>
    </div>
  );
}
