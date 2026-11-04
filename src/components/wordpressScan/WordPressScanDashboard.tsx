"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Card } from "@/components/ui/Card";

interface Summary {
  applicationCount: number;
  scansRun: number;
  openCount: number;
  remediatedCount: number;
  exceptionCount: number;
  statusBreakdown: { status: string; count: number }[];
  severityByMonth: { month: string; critical: number; high: number; medium: number; low: number; info: number }[];
}

const STAT_CARDS: { key: keyof Summary; label: string; color: string }[] = [
  { key: "applicationCount", label: "WordPress Sites", color: "var(--primary)" },
  { key: "scansRun", label: "Scans Run", color: "var(--success)" },
  { key: "openCount", label: "Open Vulnerabilities", color: "var(--danger)" },
  { key: "remediatedCount", label: "Remediated", color: "var(--success)" },
  { key: "exceptionCount", label: "Exceptions", color: "var(--warning)" },
];

const STATUS_COLORS: Record<string, string> = {
  Open: "var(--danger)",
  Resolved: "var(--success)",
  AcceptedRisk: "var(--warning)",
  FalsePositive: "var(--info)",
};

const STATUS_LABELS: Record<string, string> = {
  Open: "Open",
  Resolved: "Closed",
  AcceptedRisk: "Exception",
  FalsePositive: "False Positive",
};

const SEVERITY_SERIES: { key: "critical" | "high" | "medium" | "low" | "info"; label: string; color: string }[] = [
  { key: "critical", label: "Critical", color: "var(--danger)" },
  { key: "high", label: "High", color: "#f97316" },
  { key: "medium", label: "Medium", color: "var(--warning)" },
  { key: "low", label: "Low", color: "var(--success)" },
  { key: "info", label: "Informational", color: "var(--info)" },
];

export default function WordPressScanDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/wordpress-scan/summary");
        const data = await res.json();
        if (data.ok) setSummary(data.data);
      } catch {
        // Dashboard summary is a nice-to-have on top of the real scan/findings tabs below —
        // a failed fetch here just leaves the summary section empty, nothing else degrades.
      }
    })();
  }, []);

  if (!summary) return null;

  const totalFindings = summary.statusBreakdown.reduce((sum, s) => sum + s.count, 0);

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.85rem", marginBottom: "1rem" }}>
        {STAT_CARDS.map((card) => (
          <Card key={card.key} hoverLift tilt3d style={{ padding: "1rem" }}>
            <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "0.4rem" }}>{card.label}</div>
            <div style={{ fontSize: "1.9rem", fontWeight: 700, color: card.color }}>{summary[card.key]}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) minmax(320px, 2fr)", gap: "0.85rem" }}>
        <Card hoverLift tilt3d style={{ padding: "1.1rem" }}>
          <h3 style={{ fontSize: "0.95rem", marginTop: 0, marginBottom: "0.9rem" }}>Vulnerability Status</h3>
          <div style={{ height: 220, position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={summary.statusBreakdown} dataKey="count" nameKey="status" innerRadius={60} outerRadius={90} paddingAngle={2}>
                  {summary.statusBreakdown.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "var(--ink-muted)"} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [value, STATUS_LABELS[name] ?? name]} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none" }}>
              <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{totalFindings}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>Total</div>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginTop: "0.75rem", fontSize: "0.78rem" }}>
            {summary.statusBreakdown.map((s) => (
              <div key={s.status} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: STATUS_COLORS[s.status] ?? "var(--ink-muted)", display: "inline-block" }} />
                {STATUS_LABELS[s.status] ?? s.status} {s.count}
              </div>
            ))}
          </div>
        </Card>

        <Card hoverLift tilt3d style={{ padding: "1.1rem" }}>
          <h3 style={{ fontSize: "0.95rem", marginTop: 0, marginBottom: "0.9rem" }}>Vulnerable Items by Risk Rating</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summary.severityByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--ink-muted)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--ink-muted)" allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                {SEVERITY_SERIES.map((s) => (
                  <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} fill={s.color} fillOpacity={0.25} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
