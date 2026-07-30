"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface OverviewData {
  totalMonitors: number;
  websiteMonitors: number;
  apiMonitors: number;
  upCount: number;
  downCount: number;
  degradedCount: number;
  pausedCount: number;
  maintenanceCount: number;
  openIncidents: number;
  sslExpiringSoon: number;
  overallUptimePercent: number | null;
  avgResponseMs: number | null;
  checksToday: number;
  failedToday: number;
  alertsToday: number;
  recentIncidents: { Id: number; Title: string; Severity: string; Status: string; StartedAt: string; MonitorName: string }[];
  recoveredRecently: { Id: number; Title: string; ResolvedAt: string; MonitorName: string }[];
  slowestWebsites: { Id: number; Name: string; Url: string; AvgResponseMs: number }[];
  expiringSsl: { MonitorName: string; Domain: string; DaysRemaining: number }[];
  recentNotifications: { EventType: string; Subject: string; Status: string; CreatedAt: string; MonitorName: string | null }[];
}

const cardStyle: React.CSSProperties = {
  padding: "1rem",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  minWidth: 160,
  flex: "1 1 160px",
};

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>{label}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: 700, color: color ?? "var(--ink)" }}>{value}</div>
    </div>
  );
}

export function OverviewClient() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [environment, setEnvironment] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (environment) params.set("environment", environment);
    fetch(`/api/admin/monitoring/overview?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setData(d.data);
      });
  }, [environment]);

  if (!data) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <input
          value={environment}
          onChange={(e) => setEnvironment(e.target.value)}
          placeholder="Filter by environment (e.g. Production)"
          style={{ padding: "0.5rem 0.7rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.85rem", maxWidth: 280 }}
        />
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <Stat label="Total Monitors" value={data.totalMonitors} />
        <Stat label="Up" value={data.upCount} color="var(--success)" />
        <Stat label="Down" value={data.downCount} color="var(--danger)" />
        <Stat label="Degraded" value={data.degradedCount} color="var(--warning)" />
        <Stat label="Paused" value={data.pausedCount} />
        <Stat label="Maintenance" value={data.maintenanceCount} />
        <Stat label="Open Incidents" value={data.openIncidents} color={data.openIncidents > 0 ? "var(--danger)" : undefined} />
        <Stat label="SSL Expiring Soon" value={data.sslExpiringSoon} color={data.sslExpiringSoon > 0 ? "var(--warning)" : undefined} />
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <Stat label="Uptime (7d)" value={data.overallUptimePercent !== null ? `${data.overallUptimePercent.toFixed(2)}%` : "-"} />
        <Stat label="Avg Response" value={data.avgResponseMs !== null ? `${Math.round(data.avgResponseMs)}ms` : "-"} />
        <Stat label="Checks Today" value={data.checksToday} />
        <Stat label="Failed Today" value={data.failedToday} color={data.failedToday > 0 ? "var(--danger)" : undefined} />
        <Stat label="Alerts Sent Today" value={data.alertsToday} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div className="dash-panel">
          <h3 style={{ fontSize: "1rem", marginTop: 0 }}>Recent Incidents</h3>
          {data.recentIncidents.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No incidents recorded yet.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
              {data.recentIncidents.map((i) => (
                <li key={i.Id}>
                  <Link href={`/dashboard/monitoring/incidents/${i.Id}`} style={{ color: "var(--series-1)" }}>
                    {i.MonitorName}
                  </Link>{" "}
                  - {i.Status} ({i.Severity}) - {new Date(i.StartedAt).toLocaleString()}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dash-panel">
          <h3 style={{ fontSize: "1rem", marginTop: 0 }}>Recently Recovered</h3>
          {data.recoveredRecently.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>None yet.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
              {data.recoveredRecently.map((i) => (
                <li key={i.Id}>
                  {i.MonitorName} - recovered {new Date(i.ResolvedAt).toLocaleString()}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dash-panel">
          <h3 style={{ fontSize: "1rem", marginTop: 0 }}>Slowest Websites (24h)</h3>
          {data.slowestWebsites.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No data yet.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
              {data.slowestWebsites.map((w) => (
                <li key={w.Id}>
                  <Link href={`/dashboard/monitoring/websites/${w.Id}`} style={{ color: "var(--series-1)" }}>
                    {w.Name}
                  </Link>{" "}
                  - {Math.round(w.AvgResponseMs)}ms avg
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dash-panel">
          <h3 style={{ fontSize: "1rem", marginTop: 0 }}>Expiring SSL Certificates</h3>
          {data.expiringSsl.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>None expiring within 30 days.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
              {data.expiringSsl.map((s, i) => (
                <li key={i} style={{ color: s.DaysRemaining <= 7 ? "var(--danger)" : "var(--warning)" }}>
                  {s.MonitorName} ({s.Domain}) - {s.DaysRemaining} day(s) remaining
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="dash-panel" style={{ marginTop: "1rem" }}>
        <h3 style={{ fontSize: "1rem", marginTop: 0 }}>Recent Notification Activity</h3>
        {data.recentNotifications.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No notifications sent yet.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
            {data.recentNotifications.map((n, i) => (
              <li key={i}>
                {n.EventType} - {n.MonitorName ?? "-"} - <span style={{ color: n.Status === "Sent" ? "var(--success)" : "var(--danger)" }}>{n.Status}</span> -{" "}
                {new Date(n.CreatedAt).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
