"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDisplaySettings } from "@/lib/useDisplaySettings";
import { formatDateTime } from "@/lib/dateFormat";

interface IncidentRow {
  Id: number;
  Title: string;
  Severity: string;
  Status: string;
  StartedAt: string;
  ResolvedAt: string | null;
  DowntimeSeconds: number | null;
  MonitorName: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  Low: "var(--ink-muted)",
  Medium: "var(--warning)",
  High: "var(--danger)",
  Critical: "var(--danger)",
};

export function IncidentsListClient() {
  const displaySettings = useDisplaySettings();
  const [status, setStatus] = useState<string>("");
  const [rows, setRows] = useState<IncidentRow[] | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    fetch(`/api/admin/monitoring/incidents?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => d.ok && setRows(d.data));
  }, [status]);

  return (
    <div>
      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem" }}>
        {["", "Open", "Resolved"].map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatus(s)}
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: status === s ? "var(--sidebar-accent, var(--series-1))" : "var(--surface)",
              color: status === s ? "#fff" : "var(--ink)",
              cursor: "pointer",
              fontSize: "0.8rem",
            }}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="dash-panel">
        {rows === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No incidents recorded yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}>Monitor</th>
                  <th style={{ padding: "0.4rem" }}>Title</th>
                  <th style={{ padding: "0.4rem" }}>Severity</th>
                  <th style={{ padding: "0.4rem" }}>Status</th>
                  <th style={{ padding: "0.4rem" }}>Started</th>
                  <th style={{ padding: "0.4rem" }}>Downtime</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>{i.MonitorName}</td>
                    <td style={{ padding: "0.4rem" }}>
                      <Link href={`/dashboard/monitoring/incidents/${i.Id}`} style={{ color: "var(--series-1)" }}>
                        {i.Title}
                      </Link>
                    </td>
                    <td style={{ padding: "0.4rem", color: SEVERITY_COLOR[i.Severity] ?? "var(--ink)", fontWeight: 600 }}>{i.Severity}</td>
                    <td style={{ padding: "0.4rem" }}>{i.Status}</td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{formatDateTime(new Date(i.StartedAt), displaySettings)}</td>
                    <td style={{ padding: "0.4rem" }}>{i.DowntimeSeconds != null ? `${Math.round(i.DowntimeSeconds / 60)} min` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
