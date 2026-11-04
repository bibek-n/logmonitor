"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { parseJsonResponse } from "@/lib/apiFetch";

export interface AlertHistoryRow {
  EventTime: string;
  Severity: string;
  Detail: string;
  Ip: string | null;
}

const SEVERITY_COLOR: Record<string, string> = {
  warning: "var(--warning)",
  error: "var(--danger)",
  critical: "var(--danger)",
  alert: "var(--danger)",
  emergency: "var(--danger)",
  info: "var(--info, var(--primary))",
};

const DAY_OPTIONS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
];

export function AlertHistoryClient({ initialAlerts, initialDays }: { initialAlerts: AlertHistoryRow[]; initialDays: number }) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [days, setDays] = useState(String(initialDays));
  const [loading, setLoading] = useState(false);

  async function handleDaysChange(value: string) {
    setDays(value);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/alerts/history?days=${encodeURIComponent(value)}`);
      const data = (await parseJsonResponse(res)) as { ok: boolean; alerts?: AlertHistoryRow[] };
      if (data.ok && data.alerts) setAlerts(data.alerts);
    } catch {
      // Silent - keeps showing the previously-loaded range on failure.
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>{alerts.length} alert{alerts.length === 1 ? "" : "s"}</span>
        <div style={{ minWidth: 160 }}>
          <Select value={days} onChange={handleDaysChange} options={DAY_OPTIONS} />
        </div>
      </div>
      <div style={{ overflowX: "auto", opacity: loading ? 0.6 : 1, transition: "opacity 0.15s" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              {["Severity", "Detail", "IP", "When"].map((h) => (
                <th key={h} style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alerts.map((a, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.4rem 0.6rem" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: SEVERITY_COLOR[a.Severity] ?? "var(--ink-muted)", display: "inline-block" }} />
                    {a.Severity}
                  </span>
                </td>
                <td style={{ padding: "0.4rem 0.6rem", color: "var(--ink)" }}>{a.Detail}</td>
                <td style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)" }}>{a.Ip ?? "—"}</td>
                <td style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)", whiteSpace: "nowrap" }}>{new Date(a.EventTime).toLocaleString()}</td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "1rem", textAlign: "center", color: "var(--ink-muted)" }}>
                  No alerts in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
