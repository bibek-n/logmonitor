"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Overview {
  overallScore: number;
  riskLevel: string;
  componentScores: Record<string, number>;
  scoreTrend: { snapshotAt: string; overallScore: number }[];
  assetCounts: { websites: number; servers: number; workstations: number };
  vulnerabilityCountsBySeverity: Record<string, number>;
  malwareCountsBySeverity: Record<string, number>;
  intrusionAlertCountsBySeverity: Record<string, number>;
  activeIncidentsCount: number;
  sslExpiringSoon: { monitorName: string; expiresAt: string }[];
  topThreatSources: { countryCode: string | null; count: number }[];
  recentEvents: { source: string; title: string; severity: string; occurredAt: string; detailUrl: string }[];
  recommendedActions: string[];
}

const SEVERITY_TONE: Record<string, "danger" | "warning" | "info" | "neutral"> = {
  Critical: "danger",
  High: "danger",
  Medium: "warning",
  Low: "info",
  Informational: "neutral",
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "info",
  informational: "neutral",
};

function riskTone(risk: string): "success" | "warning" | "danger" {
  if (risk === "Low") return "success";
  if (risk === "Medium") return "warning";
  return "danger";
}

function severityCard(label: string, counts: Record<string, number>) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return (
    <Card key={label}>
      <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)", marginBottom: "0.3rem" }}>{label}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "0.4rem" }}>{total}</div>
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        {Object.entries(counts)
          .filter(([, n]) => n > 0)
          .map(([severity, n]) => (
            <Badge key={severity} tone={SEVERITY_TONE[severity] ?? "neutral"}>
              {severity}: {n}
            </Badge>
          ))}
      </div>
    </Card>
  );
}

export function SecurityDashboardClient() {
  const [overview, setOverview] = useState<Overview | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/security-center/overview");
    const data = await res.json();
    if (res.ok && data.ok) setOverview(data.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!overview) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;

  const trendData = overview.scoreTrend.map((t) => ({ Date: new Date(t.snapshotAt).toLocaleDateString(), Score: t.overallScore }));
  const countryData = overview.topThreatSources.map((t) => ({ Country: t.countryCode ?? "Unknown", Count: t.count }));

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
        <Card>
          <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)", marginBottom: "0.3rem" }}>Overall Security Score</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <span style={{ fontSize: "2rem", fontWeight: 700 }}>{overview.overallScore}</span>
            <Badge tone={riskTone(overview.riskLevel)}>{overview.riskLevel} Risk</Badge>
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)", marginBottom: "0.3rem" }}>Assets Protected</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{overview.assetCounts.websites + overview.assetCounts.servers + overview.assetCounts.workstations}</div>
          <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>
            {overview.assetCounts.websites} website(s), {overview.assetCounts.servers} server(s), {overview.assetCounts.workstations} workstation(s)
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)", marginBottom: "0.3rem" }}>Active Incidents</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{overview.activeIncidentsCount}</div>
          <Link href="/dashboard/monitoring/incidents" style={{ fontSize: "0.78rem", color: "var(--accent)" }}>
            View Incidents
          </Link>
        </Card>
        <Card>
          <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)", marginBottom: "0.3rem" }}>SSL Certificates Expiring Soon</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{overview.sslExpiringSoon.length}</div>
          <Link href="/dashboard/monitoring/ssl-certificates" style={{ fontSize: "0.78rem", color: "var(--accent)" }}>
            View SSL Certificates
          </Link>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
        {severityCard("Vulnerabilities (Vulnerability Scanner)", overview.vulnerabilityCountsBySeverity)}
        {severityCard("Malware Detections (Malware Detection)", overview.malwareCountsBySeverity)}
        {severityCard("Intrusion Alerts (Intrusion Detection / DDoS)", overview.intrusionAlertCountsBySeverity)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <Card>
          <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>Security Score Trend</h3>
          {trendData.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No trend history yet — snapshots accumulate hourly going forward.</p>
          ) : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="Date" tick={{ fontSize: 10 }} stroke="var(--ink-muted)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--ink-muted)" domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: "0.78rem" }} />
                  <Line type="monotone" dataKey="Score" stroke="var(--primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>Top Threat Sources</h3>
          {countryData.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No attributed threat traffic recorded yet.</p>
          ) : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={countryData} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="Country" tick={{ fontSize: 11 }} stroke="var(--ink-muted)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--ink-muted)" allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: "0.78rem" }} />
                  <Bar dataKey="Count" fill="var(--danger)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p style={{ color: "var(--ink-muted)", fontSize: "0.72rem", marginTop: "0.5rem", marginBottom: 0 }}>
            Derived from Intrusion Detection's request-rate anomaly data — not volumetric DDoS packet capture.{" "}
            <Link href="/dashboard/ddos-detection" style={{ color: "var(--accent)" }}>
              View DDoS Detection
            </Link>
          </p>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <Card>
          <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>Recommended Actions</h3>
          <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.85rem" }}>
            {overview.recommendedActions.map((a, i) => (
              <li key={i} style={{ marginBottom: "0.3rem" }}>
                {a}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>Recent Security Events</h3>
          {overview.recentEvents.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No recent events.</p>
          ) : (
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {overview.recentEvents.map((e, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.35rem 0", borderBottom: "1px solid var(--grid)" }}>
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "var(--ink-muted)", marginRight: "0.4rem" }}>{e.source}</span>
                    <Link href={e.detailUrl} style={{ fontSize: "0.85rem" }}>
                      {e.title}
                    </Link>
                  </div>
                  <Badge tone={SEVERITY_TONE[e.severity] ?? "neutral"}>{e.severity}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
