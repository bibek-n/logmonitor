"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { riskBadgeStyle, formatDwell } from "./riskTones";

interface TopDomain {
  Domain: string;
  CategoryName: string | null;
  RiskLevel: string | null;
  VisitCount: number;
  TotalDwellSeconds: number;
}

interface ByCategory {
  CategoryName: string;
  VisitCount: number;
}

interface ByDevice {
  DeviceId: string;
  Hostname: string;
  VisitCount: number;
}

interface DailyTrend {
  Day: string;
  VisitCount: number;
}

interface DashboardStats {
  topDomains: TopDomain[];
  byCategory: ByCategory[];
  byDevice: ByDevice[];
  dailyTrend: DailyTrend[];
  securityEventCount: number;
}

const cardStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "0.25rem" };
const bigNumberStyle: React.CSSProperties = { fontSize: "1.6rem", fontWeight: 700, color: "var(--ink)" };
const labelStyle: React.CSSProperties = { fontSize: "0.78rem", color: "var(--ink-muted)" };

export function DashboardClient({ canViewSecurityAlerts }: { canViewSecurityAlerts: boolean }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [rangeDays, setRangeDays] = useState(7);

  useEffect(() => {
    (async () => {
      const dateFrom = new Date(Date.now() - rangeDays * 86400000).toISOString();
      const res = await fetch(`/api/admin/browser-activity/dashboard?dateFrom=${encodeURIComponent(dateFrom)}`);
      const data = await res.json();
      if (res.ok && data.ok) setStats(data.data);
    })();
  }, [rangeDays]);

  if (!stats) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;

  const totalVisits = stats.byCategory.reduce((sum, c) => sum + c.VisitCount, 0);
  const maxTrend = Math.max(1, ...stats.dailyTrend.map((d) => d.VisitCount));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Browser Activity Dashboard</h1>
        <select
          value={rangeDays}
          onChange={(e) => setRangeDays(Number(e.target.value))}
          style={{ padding: "0.4rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.82rem" }}
        >
          <option value={1}>Last 24 hours</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <Card style={cardStyle}>
          <span style={labelStyle}>Total Visits</span>
          <span style={bigNumberStyle}>{totalVisits}</span>
        </Card>
        <Card style={cardStyle}>
          <span style={labelStyle}>Devices Active</span>
          <span style={bigNumberStyle}>{stats.byDevice.length}</span>
        </Card>
        <Card style={cardStyle}>
          <span style={labelStyle}>Unique Domains</span>
          <span style={bigNumberStyle}>{stats.topDomains.length}</span>
        </Card>
        <Card style={{ ...cardStyle, ...(stats.securityEventCount > 0 ? { border: "1px solid var(--danger)" } : {}) }}>
          <span style={labelStyle}>Security Alerts</span>
          {canViewSecurityAlerts ? (
            <Link href="/dashboard/browser-activity/security-alerts" style={{ ...bigNumberStyle, color: stats.securityEventCount > 0 ? "var(--danger)" : "var(--ink)", textDecoration: "none" }}>
              {stats.securityEventCount}
            </Link>
          ) : (
            <span style={bigNumberStyle}>{stats.securityEventCount}</span>
          )}
        </Card>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <Card>
          <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>Top Domains</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.4rem 0.5rem", color: "var(--ink-muted)", fontWeight: 500 }}>Domain</th>
                <th style={{ padding: "0.4rem 0.5rem", color: "var(--ink-muted)", fontWeight: 500 }}>Category</th>
                <th style={{ padding: "0.4rem 0.5rem", color: "var(--ink-muted)", fontWeight: 500 }}>Visits</th>
                <th style={{ padding: "0.4rem 0.5rem", color: "var(--ink-muted)", fontWeight: 500 }}>Est. Time</th>
              </tr>
            </thead>
            <tbody>
              {stats.topDomains.map((d) => (
                <tr key={d.Domain} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.4rem 0.5rem" }}>{d.Domain}</td>
                  <td style={{ padding: "0.4rem 0.5rem" }}>
                    <span style={riskBadgeStyle(d.RiskLevel ?? "none")}>{d.CategoryName ?? "Uncategorized"}</span>
                  </td>
                  <td style={{ padding: "0.4rem 0.5rem" }}>{d.VisitCount}</td>
                  <td style={{ padding: "0.4rem 0.5rem" }}>{formatDwell(d.TotalDwellSeconds)}</td>
                </tr>
              ))}
              {stats.topDomains.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: "1rem", textAlign: "center", color: "var(--ink-muted)" }}>
                    No activity recorded in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>By Category</h3>
            <div className="flex flex-col gap-2">
              {stats.byCategory.map((c) => (
                <div key={c.CategoryName} className="flex items-center justify-between" style={{ fontSize: "0.82rem" }}>
                  <span>{c.CategoryName}</span>
                  <span style={{ color: "var(--ink-muted)" }}>{c.VisitCount}</span>
                </div>
              ))}
              {stats.byCategory.length === 0 && <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No data.</p>}
            </div>
          </Card>

          <Card>
            <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>By Device</h3>
            <div className="flex flex-col gap-2">
              {stats.byDevice.slice(0, 8).map((d) => (
                <div key={d.DeviceId} className="flex items-center justify-between" style={{ fontSize: "0.82rem" }}>
                  <span>{d.Hostname}</span>
                  <span style={{ color: "var(--ink-muted)" }}>{d.VisitCount}</span>
                </div>
              ))}
              {stats.byDevice.length === 0 && <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No data.</p>}
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>Daily Trend</h3>
        <div className="flex items-end gap-2" style={{ height: 120 }}>
          {stats.dailyTrend.map((d) => (
            <div key={d.Day} className="flex flex-col items-center gap-1" style={{ flex: 1, minWidth: 0 }} title={`${d.Day}: ${d.VisitCount} visits`}>
              <div
                style={{
                  width: "100%",
                  maxWidth: 28,
                  height: Math.max(4, (d.VisitCount / maxTrend) * 90),
                  background: "var(--primary)",
                  borderRadius: 3,
                }}
              />
              <span style={{ fontSize: "0.65rem", color: "var(--ink-muted)", whiteSpace: "nowrap" }}>{d.Day.slice(5)}</span>
            </div>
          ))}
          {stats.dailyTrend.length === 0 && <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No data.</p>}
        </div>
      </Card>
    </div>
  );
}
