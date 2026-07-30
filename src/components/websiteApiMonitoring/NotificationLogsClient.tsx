"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface LogRow {
  Id: number;
  EventType: string;
  MonitorName: string | null;
  Recipient: string | null;
  Subject: string | null;
  Provider: string;
  Status: string;
  SentAt: string | null;
  FailureReason: string | null;
  CreatedAt: string;
  RetryCount: number;
  NextRetryAt: string | null;
  CanRetry: boolean;
}

function NotificationLogsInner() {
  const toast = useToast();
  const [rows, setRows] = useState<LogRow[] | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/monitoring/notification-logs");
    const data = await res.json();
    if (res.ok && data.ok) setRows(data.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function retry(row: LogRow) {
    setRetryingId(row.Id);
    try {
      const res = await fetch(`/api/admin/monitoring/notification-logs/${row.Id}/retry`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Retry failed.");
      toast.show({ type: data.data?.success ? "success" : "error", message: data.data?.success ? "Notification resent successfully." : data.data?.error ?? "Retry attempt failed." });
      await load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Retry failed." });
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div className="dash-panel">
      {rows === null ? (
        <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--ink-muted)" }}>No notifications sent yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                <th style={{ padding: "0.4rem" }}>Event</th>
                <th style={{ padding: "0.4rem" }}>Monitor</th>
                <th style={{ padding: "0.4rem" }}>Channel</th>
                <th style={{ padding: "0.4rem" }}>Recipient</th>
                <th style={{ padding: "0.4rem" }}>Subject</th>
                <th style={{ padding: "0.4rem" }}>Status</th>
                <th style={{ padding: "0.4rem" }}>Sent At</th>
                <th style={{ padding: "0.4rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem" }}>{r.EventType}</td>
                  <td style={{ padding: "0.4rem" }}>{r.MonitorName ?? "-"}</td>
                  <td style={{ padding: "0.4rem" }}>{r.Provider}</td>
                  <td style={{ padding: "0.4rem" }}>{r.Recipient ?? "-"}</td>
                  <td style={{ padding: "0.4rem" }}>{r.Subject ?? "-"}</td>
                  <td style={{ padding: "0.4rem", color: r.Status === "Sent" ? "var(--success)" : r.Status === "Failed" ? "var(--danger)" : "var(--ink-muted)" }}>
                    {r.Status}
                    {r.RetryCount > 0 ? ` (retry ${r.RetryCount})` : ""}
                  </td>
                  <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{r.SentAt ? new Date(r.SentAt).toLocaleString() : "-"}</td>
                  <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                    {r.CanRetry && (
                      <Button size="sm" variant="secondary" onClick={() => retry(r)} disabled={retryingId === r.Id}>
                        {retryingId === r.Id ? "Retrying..." : "Retry Now"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function NotificationLogsClient() {
  return (
    <ToastProvider>
      <NotificationLogsInner />
    </ToastProvider>
  );
}
