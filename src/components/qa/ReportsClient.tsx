"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";

interface QaProjectOption { Id: number; Name: string }

interface Summary {
  totalTestCases: number; totalTestSuites: number; totalTestRuns: number; activeTestRuns: number;
  openBugs: number; passRatePercent: number | null; executedCaseCount: number;
}
interface StatusCount { Status: string; Cnt: number }
interface BugBreakdown { byStatus: StatusCount[]; bySeverity: { Severity: string; Cnt: number }[] }
interface TrendPoint { date: string; total: number; passed: number; passRatePercent: number }
interface FailurePoint { date: string; failed: number; blocked: number }
interface TesterActivity { UserId: number; Username: string; Executed: number; Passed: number; Failed: number }

const DAY_OPTIONS = ["7", "30", "90"];

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url);
  const data = await res.json();
  return res.ok && data.ok ? data.data : null;
}

export function ReportsClient({ projects }: { projects: QaProjectOption[] }) {
  const [projectId, setProjectId] = useState<number | null>(null);
  const [days, setDays] = useState("30");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusCount[]>([]);
  const [bugBreakdown, setBugBreakdown] = useState<BugBreakdown | null>(null);
  const [passRateTrend, setPassRateTrend] = useState<TrendPoint[]>([]);
  const [failureTrend, setFailureTrend] = useState<FailurePoint[]>([]);
  const [testerActivity, setTesterActivity] = useState<TesterActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const projectParam = projectId ? `&projectId=${projectId}` : "";
    Promise.all([
      fetchJson<Summary>(`/api/admin/qa/dashboard/summary?${projectParam.slice(1)}`),
      fetchJson<StatusCount[]>(`/api/admin/qa/dashboard/status-breakdown?${projectParam.slice(1)}`),
      fetchJson<BugBreakdown>(`/api/admin/qa/dashboard/bug-status-breakdown?${projectParam.slice(1)}`),
      fetchJson<TrendPoint[]>(`/api/admin/qa/dashboard/pass-rate-trend?days=${days}`),
      fetchJson<FailurePoint[]>(`/api/admin/qa/dashboard/failure-trend?days=${days}`),
      fetchJson<TesterActivity[]>(`/api/admin/qa/dashboard/tester-activity?days=${days}`),
    ]).then(([s, sb, bb, prt, ft, ta]) => {
      if (cancelled) return;
      setSummary(s);
      setStatusBreakdown(sb ?? []);
      setBugBreakdown(bb);
      setPassRateTrend(prt ?? []);
      setFailureTrend(ft ?? []);
      setTesterActivity(ta ?? []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [projectId, days]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4" style={{ flexWrap: "wrap" }}>
        <div style={{ width: 200 }}>
          <Select value={projectId ? String(projectId) : ""} onChange={(v) => setProjectId(v ? Number(v) : null)} placeholder="All projects" options={projects.map((p) => ({ label: p.Name, value: String(p.Id) }))} />
        </div>
        <div style={{ width: 140 }}>
          <Select value={days} onChange={setDays} options={DAY_OPTIONS.map((d) => ({ label: `Last ${d} days`, value: d }))} />
        </div>
      </div>

      {summary && (
        <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {[
            { label: "Test Cases", value: summary.totalTestCases },
            { label: "Test Suites", value: summary.totalTestSuites },
            { label: "Test Runs", value: `${summary.activeTestRuns} active / ${summary.totalTestRuns}` },
            { label: "Open Bugs", value: summary.openBugs },
            { label: "Pass Rate", value: summary.passRatePercent !== null ? `${summary.passRatePercent}%` : "—" },
          ].map((k) => (
            <Card key={k.label}>
              <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>{k.value}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>{k.label}</div>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))" }}>
        <Card>
          <h2 style={{ fontSize: "0.9rem", marginTop: 0 }}>Pass Rate Trend</h2>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={passRateTrend} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--ink-muted)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--ink-muted)" domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: "0.78rem" }} />
                <Line type="monotone" dataKey="passRatePercent" name="Pass rate %" stroke="var(--success)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 style={{ fontSize: "0.9rem", marginTop: 0 }}>Failure Trend</h2>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={failureTrend} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--ink-muted)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--ink-muted)" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: "0.78rem" }} />
                <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                <Bar dataKey="failed" name="Failed" fill="var(--danger)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="blocked" name="Blocked" fill="var(--warning)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 style={{ fontSize: "0.9rem", marginTop: 0 }}>Test Case Status</h2>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusBreakdown} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="Status" tick={{ fontSize: 11 }} stroke="var(--ink-muted)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--ink-muted)" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: "0.78rem" }} />
                <Bar dataKey="Cnt" name="Test Cases" fill="var(--primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 style={{ fontSize: "0.9rem", marginTop: 0 }}>Bug Status</h2>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bugBreakdown?.byStatus ?? []} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="Status" tick={{ fontSize: 10 }} stroke="var(--ink-muted)" interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--ink-muted)" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: "0.78rem" }} />
                <Bar dataKey="Cnt" name="Bugs" fill="var(--danger)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <h2 style={{ fontSize: "0.9rem", marginTop: 0 }}>Tester Activity ({days} days)</h2>
        {loading ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>Loading…</p>
        ) : testerActivity.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No executions in this period.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  {["Tester", "Executed", "Passed", "Failed"].map((h) => (
                    <th key={h} style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {testerActivity.map((t) => (
                  <tr key={t.UserId} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.4rem 0.6rem" }}>{t.Username}</td>
                    <td style={{ padding: "0.4rem 0.6rem" }}>{t.Executed}</td>
                    <td style={{ padding: "0.4rem 0.6rem" }}>{t.Passed}</td>
                    <td style={{ padding: "0.4rem 0.6rem" }}>{t.Failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
