"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface AuditRow {
  id: number;
  eventType: string;
  userId: number | null;
  username: string | null;
  protocol: string | null;
  connectionId: number | null;
  host: string | null;
  sourceIp: string | null;
  sessionId: number | null;
  action: string | null;
  result: "Success" | "Failure";
  failureReason: string | null;
  durationMs: number | null;
  createdAt: string;
}

const EVENT_TYPES = [
  "ConnectionStarted", "ConnectionCompleted", "ConnectionFailed", "SessionDisconnected", "AuthenticationFailed",
  "HostKeyChanged", "CertificateRejected", "CommandExecuted", "ScriptExecuted", "FileUploaded", "FileDownloaded",
  "FileDeleted", "PortForwardingStarted", "PortForwardingStopped", "CredentialUsed", "CredentialRevealed",
  "DeviceRestarted", "DeviceShutDown",
];

const inputStyle = { padding: "0.45rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.85rem" };

export function ConnectionLogsClient() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [eventType, setEventType] = useState("");

  const load = useCallback(async () => {
    const qs = eventType ? `?eventType=${encodeURIComponent(eventType)}` : "";
    const res = await fetch(`/api/admin/remote-access/logs${qs}`);
    const data = await res.json();
    if (res.ok && data.ok) setRows(data.data);
  }, [eventType]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <Card style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.78rem" }}>Event Type</label>
            <select value={eventType} onChange={(e) => setEventType(e.target.value)} style={inputStyle}>
              <option value="">All events</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <Button variant="secondary" onClick={load}>
            Refresh
          </Button>
        </div>
      </Card>

      <div className="dash-panel">
        {rows === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No audit events yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                <th style={{ padding: "0.4rem" }}>Time</th>
                <th style={{ padding: "0.4rem" }}>Event</th>
                <th style={{ padding: "0.4rem" }}>User</th>
                <th style={{ padding: "0.4rem" }}>Host</th>
                <th style={{ padding: "0.4rem" }}>Action</th>
                <th style={{ padding: "0.4rem" }}>Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem", whiteSpace: "nowrap", color: "var(--ink-muted)" }}>{new Date(r.createdAt).toLocaleString()}</td>
                  <td style={{ padding: "0.4rem" }}>{r.eventType}</td>
                  <td style={{ padding: "0.4rem" }}>{r.username ?? "-"}</td>
                  <td style={{ padding: "0.4rem" }}>{r.host ?? "-"}</td>
                  <td style={{ padding: "0.4rem" }}>{r.action ?? "-"}</td>
                  <td style={{ padding: "0.4rem" }}>
                    <Badge tone={r.result === "Success" ? "success" : "danger"}>{r.result}</Badge>
                    {r.failureReason && <span style={{ marginLeft: 6, color: "var(--ink-muted)", fontSize: "0.75rem" }}>{r.failureReason}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
