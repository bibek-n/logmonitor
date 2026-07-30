"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface NotificationRow {
  id: number;
  alertType: string;
  assetId: number | null;
  assetTag: string | null;
  severity: "Critical" | "High" | "Medium" | "Low";
  title: string;
  message: string | null;
  isRead: boolean;
  createdAt: string;
}

const SEVERITY_TONE: Record<string, "danger" | "warning" | "info" | "neutral"> = {
  Critical: "danger",
  High: "warning",
  Medium: "info",
  Low: "neutral",
};

const inputStyle = {
  padding: "0.45rem 0.6rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

function AlertsInner() {
  const toast = useToast();
  const [notifications, setNotifications] = useState<NotificationRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [isReadFilter, setIsReadFilter] = useState("unread");
  const [severity, setSeverity] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (isReadFilter !== "all") params.set("isRead", isReadFilter === "read" ? "true" : "false");
    if (severity) params.set("severity", severity);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    const res = await fetch(`/api/admin/it-asset-logsheet/notifications?${params.toString()}`);
    const data = await res.json();
    if (res.ok && data.ok) {
      setNotifications(data.data.notifications);
      setTotal(data.data.total);
    }
  }, [isReadFilter, severity, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(id: number) {
    const res = await fetch(`/api/admin/it-asset-logsheet/notifications/${id}`, { method: "PATCH" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: "Failed to mark as read." });
      return;
    }
    await load();
  }

  async function markAllRead() {
    if (!confirm("Mark all alerts as read?")) return;
    const res = await fetch("/api/admin/it-asset-logsheet/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: "Failed to mark alerts as read." });
      return;
    }
    toast.show({ type: "success", message: `${data.data.updated} alert(s) marked as read.` });
    await load();
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <Card style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <select value={isReadFilter} onChange={(e) => { setPage(1); setIsReadFilter(e.target.value); }} style={inputStyle}>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
              <option value="all">All</option>
            </select>
            <select value={severity} onChange={(e) => { setPage(1); setSeverity(e.target.value); }} style={inputStyle}>
              <option value="">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <Button variant="secondary" onClick={markAllRead}>Mark All Read</Button>
        </div>
      </Card>

      <div className="dash-panel">
        {notifications === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : notifications.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No alerts found.</p>
        ) : (
          <>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {notifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem",
                    padding: "0.6rem 0.75rem", borderRadius: 8, border: "1px solid var(--border)",
                    background: n.isRead ? "transparent" : "var(--surface-hover, rgba(255,255,255,0.03))",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.2rem" }}>
                      <Badge tone={SEVERITY_TONE[n.severity] ?? "neutral"}>{n.severity}</Badge>
                      <strong>{n.title}</strong>
                    </div>
                    {n.message && <div style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>{n.message}</div>}
                    <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)", marginTop: "0.2rem" }}>
                      {new Date(n.createdAt).toLocaleString()}
                      {n.assetId && n.assetTag && (
                        <> &middot; <Link href={`/dashboard/it-assets/assets/${n.assetId}`}>{n.assetTag}</Link></>
                      )}
                    </div>
                  </div>
                  {!n.isRead && (
                    <Button size="sm" variant="secondary" onClick={() => markRead(n.id)}>Mark Read</Button>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", fontSize: "0.85rem", color: "var(--ink-muted)" }}>
              <span>{total} alert{total === 1 ? "" : "s"}</span>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <span>Page {page} of {totalPages}</span>
                <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AlertsClient() {
  return (
    <ToastProvider>
      <AlertsInner />
    </ToastProvider>
  );
}
