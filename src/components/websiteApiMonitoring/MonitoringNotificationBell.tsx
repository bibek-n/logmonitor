"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BellRing } from "lucide-react";

const POLL_INTERVAL_MS = 20000;

interface InAppRow {
  Id: number;
  EventType: string | null;
  Subject: string | null;
  Body: string | null;
  MonitorId: number | null;
  IncidentId: number | null;
  IsRead: boolean;
  CreatedAt: string;
}

// A separate, dedicated bell for the "InApp" monitoring alert channel - deliberately not folded
// into the existing generic HeaderClient alerts bell (which polls a different, broadcast-style
// feed with no per-user read state). This one is scoped to whichever admin the AlertContact's
// Username names, backed by InAppNotifications (see migrate-monitoring-phase3.ts).
export function MonitoringNotificationBell() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<InAppRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/admin/monitoring/in-app-notifications");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data.ok) return;
        setRows(data.data);
        setUnreadCount(data.unreadCount);
      } catch {
        // Transient network hiccup - just try again next tick.
      }
    }
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markAllRead() {
    await fetch("/api/admin/monitoring/in-app-notifications", { method: "POST" });
    setUnreadCount(0);
    setRows((r) => r.map((row) => ({ ...row, IsRead: true })));
  }

  // Nothing to show at all - most admins never receive a monitoring InApp alert, so the icon
  // stays out of the way entirely rather than adding permanent header clutter for everyone.
  if (rows.length === 0 && unreadCount === 0) return null;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open && unreadCount > 0) markAllRead();
        }}
        title="Monitoring notifications"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          color: "var(--ink-secondary)",
          cursor: "pointer",
        }}
      >
        <BellRing size={15} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--danger)",
              border: "2px solid var(--surface)",
            }}
          />
        )}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 0.5rem)",
            width: 340,
            maxHeight: 380,
            overflowY: "auto",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "0.5rem",
            boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
            zIndex: 50,
          }}
        >
          <div style={{ padding: "0.3rem 0.5rem", fontSize: "0.8rem", fontWeight: 600, color: "var(--ink)" }}>Monitoring Notifications</div>
          {rows.length === 0 ? (
            <div style={{ padding: "0.5rem", fontSize: "0.82rem", color: "var(--ink-muted)" }}>Nothing yet.</div>
          ) : (
            rows.map((r) => {
              const content = (
                <div style={{ padding: "0.5rem", borderTop: "1px solid var(--border)", fontSize: "0.8rem" }}>
                  <div style={{ color: "var(--ink)", fontWeight: 600 }}>{r.Subject ?? r.EventType ?? "Notification"}</div>
                  {r.Body && <div style={{ color: "var(--ink-muted)", marginTop: "0.1rem" }}>{r.Body}</div>}
                  <div style={{ color: "var(--ink-muted)", fontSize: "0.72rem", marginTop: "0.2rem" }}>{new Date(r.CreatedAt).toLocaleString()}</div>
                </div>
              );
              return r.IncidentId ? (
                <Link key={r.Id} href={`/dashboard/monitoring/incidents/${r.IncidentId}`} style={{ textDecoration: "none", display: "block" }} onClick={() => setOpen(false)}>
                  {content}
                </Link>
              ) : (
                <div key={r.Id}>{content}</div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
