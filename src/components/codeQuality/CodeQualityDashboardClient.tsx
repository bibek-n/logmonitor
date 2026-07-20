"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Gauge, FolderKanban, ScanLine, FileCode2, Code2, AlertCircle, OctagonAlert, TriangleAlert, Copy, Trash2, Variable, Braces, ListChecks } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Summary {
  overallQualityScore: number;
  totalProjects: number;
  totalScans: number;
  totalFilesScanned: number;
  totalLinesOfCode: number;
  totalOpenIssues: number;
  criticalIssues: number;
  highSeverityIssues: number;
  duplicationPercent: number;
  deadCodeCount: number;
  unusedVariablesCount: number;
  unusedFunctionsCount: number;
  codingStandardsViolationCount: number;
}

interface Trends {
  scoreHistory: { Date: string; QualityScore: number }[];
  issuesBySeverity: { Severity: string; Count: number }[];
  issuesByCategory: { Category: string; Count: number }[];
  mostProblematicFiles: { FilePath: string; IssueCount: number; HighOrCriticalCount: number }[];
  scanTrend: { Date: string; IssueCount: number; FilesScanned: number }[];
}

function StatCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: ReactNode; tone?: "danger" | "warning" }) {
  return (
    <Card className="flex flex-col" style={{ gap: "0.5rem", padding: "1rem" }}>
      <div className="flex items-center gap-2" style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>
        {icon}
        {label}
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: tone === "danger" ? "var(--danger)" : tone === "warning" ? "var(--warning)" : "var(--ink)" }}>{value}</div>
    </Card>
  );
}

export function CodeQualityDashboardClient() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/admin/code-quality/dashboard/summary").then((r) => r.json()),
      fetch("/api/admin/code-quality/dashboard/trends").then((r) => r.json()),
    ]).then(([summaryRes, trendsRes]) => {
      if (cancelled) return;
      if (summaryRes.ok) setSummary(summaryRes.data);
      if (trendsRes.ok) setTrends(trendsRes.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col" style={{ gap: "1rem" }}>
        <Skeleton width={220} height={22} />
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} height={80} />
          ))}
        </div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="flex flex-col" style={{ gap: "1.5rem" }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>Code Quality</h1>
          <p style={{ margin: "0.2rem 0 0", color: "var(--ink-muted)", fontSize: "0.85rem" }}>Static analysis across your scanned projects.</p>
        </div>
        <Link
          href="/dashboard/code-quality/projects"
          style={{ padding: "0.55rem 1rem", borderRadius: 8, background: "var(--primary)", color: "#fff", textDecoration: "none", fontSize: "0.85rem", fontWeight: 600 }}
        >
          View Projects
        </Link>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <StatCard icon={<Gauge size={15} />} label="Overall Quality Score" value={`${summary.overallQualityScore} / 100`} />
        <StatCard icon={<FolderKanban size={15} />} label="Total Projects" value={summary.totalProjects} />
        <StatCard icon={<ScanLine size={15} />} label="Total Scans" value={summary.totalScans} />
        <StatCard icon={<FileCode2 size={15} />} label="Files Scanned" value={summary.totalFilesScanned.toLocaleString()} />
        <StatCard icon={<Code2 size={15} />} label="Lines of Code" value={summary.totalLinesOfCode.toLocaleString()} />
        <StatCard icon={<AlertCircle size={15} />} label="Open Issues" value={summary.totalOpenIssues} />
        <StatCard icon={<OctagonAlert size={15} />} label="Critical Issues" value={summary.criticalIssues} tone={summary.criticalIssues > 0 ? "danger" : undefined} />
        <StatCard icon={<TriangleAlert size={15} />} label="High-Severity Issues" value={summary.highSeverityIssues} tone={summary.highSeverityIssues > 0 ? "warning" : undefined} />
        <StatCard icon={<Copy size={15} />} label="Duplication" value={`${summary.duplicationPercent}%`} />
        <StatCard icon={<Trash2 size={15} />} label="Dead Code" value={summary.deadCodeCount} />
        <StatCard icon={<Variable size={15} />} label="Unused Variables" value={summary.unusedVariablesCount} />
        <StatCard icon={<Braces size={15} />} label="Unused Functions" value={summary.unusedFunctionsCount} />
        <StatCard icon={<ListChecks size={15} />} label="Standards Violations" value={summary.codingStandardsViolationCount} />
      </div>

      {trends && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))" }}>
          <Card>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>Quality Score History</h3>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends.scoreHistory} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="Date" tick={{ fontSize: 10 }} stroke="var(--ink-muted)" tickFormatter={(v) => String(v).slice(5, 10)} />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--ink-muted)" domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: "0.78rem" }} />
                  <Line type="monotone" dataKey="QualityScore" name="Quality Score" stroke="var(--primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>Open Issues by Severity</h3>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends.issuesBySeverity} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="Severity" tick={{ fontSize: 11 }} stroke="var(--ink-muted)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--ink-muted)" allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: "0.78rem" }} />
                  <Bar dataKey="Count" fill="var(--danger)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>Open Issues by Category</h3>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends.issuesByCategory} layout="vertical" margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--ink-muted)" allowDecimals={false} />
                  <YAxis type="category" dataKey="Category" tick={{ fontSize: 10 }} stroke="var(--ink-muted)" width={110} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: "0.78rem" }} />
                  <Bar dataKey="Count" fill="var(--info)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>Scan Trend</h3>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends.scanTrend} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="Date" tick={{ fontSize: 10 }} stroke="var(--ink-muted)" tickFormatter={(v) => String(v).slice(5, 10)} />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--ink-muted)" allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: "0.78rem" }} />
                  <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                  <Line type="monotone" dataKey="IssueCount" name="Issues" stroke="var(--danger)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="FilesScanned" name="Files Scanned" stroke="var(--info)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card style={{ gridColumn: "1 / -1" }}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>Most Problematic Files</h3>
            {trends.mostProblematicFiles.length === 0 ? (
              <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No open issues yet.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "0.5rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>File</th>
                    <th style={{ padding: "0.5rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>Issues</th>
                    <th style={{ padding: "0.5rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>High/Critical</th>
                  </tr>
                </thead>
                <tbody>
                  {trends.mostProblematicFiles.map((f) => (
                    <tr key={f.FilePath} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "0.5rem 0.6rem", fontFamily: "monospace", fontSize: "0.78rem" }}>{f.FilePath}</td>
                      <td style={{ padding: "0.5rem 0.6rem" }}>{f.IssueCount}</td>
                      <td style={{ padding: "0.5rem 0.6rem", color: f.HighOrCriticalCount > 0 ? "var(--danger)" : "var(--ink-muted)" }}>{f.HighOrCriticalCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
