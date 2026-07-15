"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Gauge, Play, ExternalLink, Settings, RefreshCw } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ToastProvider, useToast } from "@/components/ui/Toast";

export interface WebsitePerformanceSummary {
  Id: number;
  Name: string;
  Url: string;
  Enabled: boolean;
  PerfEnabled: boolean;
  TestDevice: string | null;
  LatestScore: number | null;
  LatestScanStatus: string | null;
  LatestTestedAt: string | null;
  LatestAuditScore: number | null;
  LatestAuditRiskLevel: string | null;
}

interface DashboardSummary {
  totals: {
    totalWebsites: number;
    monitoringEnabled: number;
    testsRunning: number;
    excellent: number;
    good: number;
    needsImprovement: number;
    poor: number;
    notTested: number;
    avgScore: number | null;
    avgLoadTimeMs: number | null;
    regressions: number;
  };
  charts: {
    statusDistribution: { Excellent: number; Good: number; NeedsImprovement: number; Poor: number; NotTested: number };
    scoreOverTime: { day: string; avgScore: number | null; avgLoadMs: number | null }[];
    topSlowest: { name: string; fullyLoadedMs: number | null }[];
    mobileVsDesktop: { device: string; avgScore: number | null }[];
  };
}

const PIE_COLORS = ["var(--success)", "var(--info)", "var(--warning)", "var(--danger)", "var(--ink-muted)"];

function statusFor(score: number | null): { label: string; tone: "success" | "info" | "warning" | "danger" | "neutral" } {
  if (score === null) return { label: "Not Tested", tone: "neutral" };
  if (score >= 90) return { label: "Excellent", tone: "success" };
  if (score >= 75) return { label: "Good", tone: "info" };
  if (score >= 50) return { label: "Needs Improvement", tone: "warning" };
  return { label: "Poor", tone: "danger" };
}

function SummaryCards() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    fetch("/api/admin/website-performance/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setSummary(d.data);
      })
      .catch(() => {});
  }, []);

  if (!summary) return null;
  const t = summary.totals;

  const cards: { label: string; value: string | number }[] = [
    { label: "Monitored Websites", value: t.totalWebsites },
    { label: "Monitoring Enabled", value: t.monitoringEnabled },
    { label: "Tests Running", value: t.testsRunning },
    { label: "Excellent", value: t.excellent },
    { label: "Good", value: t.good },
    { label: "Needs Improvement", value: t.needsImprovement },
    { label: "Poor", value: t.poor },
    { label: "Avg Score", value: t.avgScore ?? "-" },
    { label: "Avg Load Time", value: t.avgLoadTimeMs != null ? `${(t.avgLoadTimeMs / 1000).toFixed(1)}s` : "-" },
    { label: "Regressions", value: t.regressions },
  ];

  const distributionData = [
    { name: "Excellent", value: t.excellent },
    { name: "Good", value: t.good },
    { name: "Needs Improvement", value: t.needsImprovement },
    { name: "Poor", value: t.poor },
    { name: "Not Tested", value: t.notTested },
  ].filter((d) => d.value > 0);

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        {cards.map((c) => (
          <Card key={c.label}>
            <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>{c.label}</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{c.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <Card>
          <h3 style={{ fontSize: "0.85rem", margin: "0 0 0.5rem" }}>Score Over Time (30d avg)</h3>
          {summary.charts.scoreOverTime.length < 2 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>Not enough data yet.</p>
          ) : (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={summary.charts.scoreOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: "0.75rem" }} />
                  <Line type="monotone" dataKey="avgScore" stroke="var(--series-1)" strokeWidth={2} dot={false} name="Avg Score" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <h3 style={{ fontSize: "0.85rem", margin: "0 0 0.5rem" }}>Status Distribution</h3>
          {distributionData.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>No tests run yet.</p>
          ) : (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distributionData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70}>
                    {distributionData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: "0.75rem" }} />
                  <Legend wrapperStyle={{ fontSize: "0.72rem" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <h3 style={{ fontSize: "0.85rem", margin: "0 0 0.5rem" }}>Top Slowest Websites</h3>
          {summary.charts.topSlowest.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>No tests run yet.</p>
          ) : (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.charts.topSlowest} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: "0.75rem" }} />
                  <Bar dataKey="fullyLoadedMs" fill="var(--warning)" name="Fully Loaded (ms)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function WebsitePerformanceClientInner({ websites }: { websites: WebsitePerformanceSummary[] }) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [speedFilter, setSpeedFilter] = useState("");
  const [monitorFilter, setMonitorFilter] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [runningIds, setRunningIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const filtered = useMemo(() => {
    return websites.filter((w) => {
      if (search && !w.Name.toLowerCase().includes(search.toLowerCase()) && !w.Url.toLowerCase().includes(search.toLowerCase())) return false;
      if (speedFilter) {
        const status = statusFor(w.LatestScore).label.replace(/\s/g, "");
        if (speedFilter === "NotTested" ? w.LatestScore !== null : status !== speedFilter) return false;
      }
      if (monitorFilter === "enabled" && !w.PerfEnabled) return false;
      if (monitorFilter === "disabled" && w.PerfEnabled) return false;
      return true;
    });
  }, [websites, search, speedFilter, monitorFilter]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runTest(id: number) {
    setRunningIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/admin/website-performance/${id}/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (data.ok) {
        toast.show({ type: "success", message: "Performance test started/completed." });
      } else {
        toast.show({ type: "error", message: data.error ?? "Failed to run test." });
      }
    } catch {
      toast.show({ type: "error", message: "Failed to run test." });
    } finally {
      setRunningIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function toggleMonitoring(w: WebsitePerformanceSummary, enabled: boolean) {
    await fetch(`/api/admin/website-performance/${w.Id}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, testDevice: w.TestDevice ?? "Both" }),
    });
    toast.show({ type: "success", message: enabled ? "Monitoring enabled." : "Monitoring disabled." });
  }

  async function bulkRun() {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/admin/website-performance/bulk-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteIds: [...selected] }),
      });
      const data = await res.json();
      toast.show({ type: data.ok ? "success" : "error", message: data.ok ? `Started tests for ${selected.size} website(s).` : data.error ?? "Bulk run failed." });
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkConfig(enabled: boolean) {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/admin/website-performance/bulk-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteIds: [...selected], enabled }),
      });
      const data = await res.json();
      toast.show({ type: data.ok ? "success" : "error", message: data.ok ? `Updated ${selected.size} website(s).` : data.error ?? "Bulk update failed." });
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div>
      <SummaryCards />

      <Card>
        <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: "0.75rem" }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by website name or URL..."
            style={{ flex: 1, minWidth: 200, padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.85rem" }}
          />
          <select value={speedFilter} onChange={(e) => setSpeedFilter(e.target.value)} style={{ padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.85rem" }}>
            <option value="">All speed statuses</option>
            <option value="Excellent">Excellent</option>
            <option value="Good">Good</option>
            <option value="NeedsImprovement">Needs Improvement</option>
            <option value="Poor">Poor</option>
            <option value="NotTested">Not Tested</option>
          </select>
          <select value={monitorFilter} onChange={(e) => setMonitorFilter(e.target.value)} style={{ padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.85rem" }}>
            <option value="">Monitoring: any</option>
            <option value="enabled">Monitoring enabled</option>
            <option value="disabled">Monitoring disabled</option>
          </select>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2" style={{ marginBottom: "0.75rem", padding: "0.5rem 0.75rem", borderRadius: 8, background: "var(--surface-2)" }}>
            <span style={{ fontSize: "0.8rem" }}>{selected.size} selected</span>
            <button disabled={bulkBusy} onClick={bulkRun} style={bulkBtnStyle}>Run Tests</button>
            <button disabled={bulkBusy} onClick={() => bulkConfig(true)} style={bulkBtnStyle}>Enable Monitoring</button>
            <button disabled={bulkBusy} onClick={() => bulkConfig(false)} style={bulkBtnStyle}>Disable Monitoring</button>
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.5rem" }}></th>
                <th style={{ padding: "0.5rem" }}>Website</th>
                <th style={{ padding: "0.5rem" }}>Audit</th>
                <th style={{ padding: "0.5rem" }}>Speed Status</th>
                <th style={{ padding: "0.5rem" }}>Score</th>
                <th style={{ padding: "0.5rem" }}>Last Tested</th>
                <th style={{ padding: "0.5rem" }}>Monitoring</th>
                <th style={{ padding: "0.5rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w) => {
                const status = statusFor(w.LatestScore);
                const running = runningIds.has(w.Id) || w.LatestScanStatus === "Running" || w.LatestScanStatus === "Pending";
                return (
                  <tr key={w.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.5rem" }}>
                      <input type="checkbox" checked={selected.has(w.Id)} onChange={() => toggleSelect(w.Id)} />
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <Link href={`/dashboard/audit/website-performance/${w.Id}`} style={{ color: "var(--series-1)", fontWeight: 500 }}>
                        {w.Name}
                      </Link>
                      <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>{w.Url}</div>
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      {w.LatestAuditScore != null ? (
                        <span>{w.LatestAuditScore} ({w.LatestAuditRiskLevel ?? "-"})</span>
                      ) : (
                        <span style={{ color: "var(--ink-muted)" }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                    <td style={{ padding: "0.5rem" }}>{w.LatestScore ?? "-"}</td>
                    <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>{w.LatestTestedAt ? new Date(w.LatestTestedAt).toLocaleString() : "Never"}</td>
                    <td style={{ padding: "0.5rem" }}>
                      <button onClick={() => toggleMonitoring(w, !w.PerfEnabled)} style={{ ...bulkBtnStyle, background: w.PerfEnabled ? "var(--success)" : "var(--surface-2)", color: w.PerfEnabled ? "#fff" : "var(--ink)" }}>
                        {w.PerfEnabled ? "Enabled" : "Disabled"}
                      </button>
                    </td>
                    <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                      <button onClick={() => runTest(w.Id)} disabled={running} title="Run Test" style={iconBtnStyle}>
                        {running ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                      </button>
                      <Link href={`/dashboard/audit/website-performance/${w.Id}`} title="View Result" style={iconBtnStyle}>
                        <Gauge size={14} />
                      </Link>
                      <Link href={`/dashboard/audit/website-performance/${w.Id}?tab=settings`} title="Configure" style={iconBtnStyle}>
                        <Settings size={14} />
                      </Link>
                      <a href={w.Url} target="_blank" rel="noreferrer" title="Open website" style={iconBtnStyle}>
                        <ExternalLink size={14} />
                      </a>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: "1rem", textAlign: "center", color: "var(--ink-muted)" }}>
                    No websites match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

const bulkBtnStyle: CSSProperties = {
  padding: "0.35rem 0.7rem",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.78rem",
  cursor: "pointer",
};

const iconBtnStyle: CSSProperties = {
  display: "inline-flex",
  padding: "0.35rem",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink-muted)",
  marginRight: 6,
  cursor: "pointer",
};

export default function WebsitePerformanceClient({ websites }: { websites: WebsitePerformanceSummary[] }) {
  return (
    <ToastProvider>
      <WebsitePerformanceClientInner websites={websites} />
    </ToastProvider>
  );
}
