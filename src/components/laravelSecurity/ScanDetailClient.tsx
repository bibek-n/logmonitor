"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LaravelSecurityTable, type LsTableColumn } from "./LaravelSecurityTable";
import { useLaravelSecurityList } from "@/hooks/useLaravelSecurityList";
import { SecurityScoreBadge, ScanStatusBadge, SeverityBadge } from "./badges";
import { IssueDetailsDrawer } from "./IssueDetailsDrawer";

interface Scan {
  Id: number;
  ProjectId: number;
  ProjectName: string;
  Branch: string | null;
  Status: string;
  StartedByUsername: string | null;
  StartedAt: string | null;
  CompletedAt: string | null;
  DurationMs: number | null;
  FilesScanned: number;
  SecurityScore: number | null;
  ErrorMessage: string | null;
}

interface IssueCount {
  Category: string;
  Cnt: number;
}

interface IssueRow {
  Id: number;
  IssueNumber: string | null;
  Title: string;
  Category: string;
  FilePath: string;
  StartLine: number | null;
  EndLine: number | null;
  Severity: string;
  Status: string;
  ConfidenceLevel: string | null;
}

// Laravel Security's 9 risk categories (see CK_LaravelSecurityIssues_Category in
// scripts/migrate-laravel-security.ts), replacing Code Quality's 6 Complexity/Duplication/
// DeadCode/UnusedVariable/UnusedFunction/CodingStandard sections.
const SECTIONS: { category: string; label: string; description: string }[] = [
  { category: "AppDebug", label: "App Debug", description: "APP_DEBUG exposure that can leak stack traces, file paths, and env values on error pages." },
  { category: "AppKey", label: "App Key", description: "Missing, weak, or default APP_KEY, undermining Laravel's session/cookie/data encryption." },
  { category: "DotEnv", label: ".env", description: ".env files committed to source control, not gitignored, or containing default/example credentials." },
  { category: "Csrf", label: "CSRF", description: "Forms or routes missing CSRF token verification." },
  { category: "MassAssignment", label: "Mass Assignment", description: "Eloquent models with unsafe or undefined mass-assignment protection." },
  { category: "Validation", label: "Validation", description: "Controller actions or route parameters that accept input with no validation." },
  { category: "Sanitization", label: "Sanitization", description: "Unescaped output of user-controlled data, risking XSS." },
  { category: "StorageLinks", label: "Storage Links", description: "Missing public disk symlink, or sensitive-looking paths stored on the public disk." },
  { category: "Queue", label: "Queue", description: "Queue configuration or job failure-handling issues." },
];

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function ScanProgress({ scanId, onScanUpdate }: { scanId: number; onScanUpdate: (scan: Scan) => void }) {
  const [lines, setLines] = useState<{ Id: number; Message: string; CreatedAt: string }[]>([]);
  const sinceRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const interval = setInterval(async () => {
      const [logRes, scanRes] = await Promise.all([
        fetch(`/api/admin/laravel-security/scans/${scanId}/log?since=${sinceRef.current}`).then((r) => r.json()),
        fetch(`/api/admin/laravel-security/scans/${scanId}`).then((r) => r.json()),
      ]);
      if (cancelled) return;
      if (logRes.ok && logRes.data.lines.length > 0) {
        setLines((prev) => [...prev, ...logRes.data.lines]);
        sinceRef.current = logRes.data.lines[logRes.data.lines.length - 1].Id;
      }
      if (scanRes.ok) onScanUpdate(scanRes.data);
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId]);

  return (
    <Card>
      <div className="flex items-center gap-2" style={{ marginBottom: "0.6rem" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--info)", display: "inline-block", animation: "pulse 1.5s infinite" }} />
        <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Scan in progress…</h3>
      </div>
      <div style={{ maxHeight: 220, overflowY: "auto", fontFamily: "monospace", fontSize: "0.76rem", color: "var(--ink-muted)", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
        {lines.length === 0 ? <div>Waiting for progress…</div> : lines.map((l) => <div key={l.Id}>{l.Message}</div>)}
      </div>
    </Card>
  );
}

export function ScanDetailClient({ scan: initialScan, issueCounts: initialIssueCounts, can }: { scan: Scan; issueCounts: IssueCount[]; can: Record<string, boolean> }) {
  const router = useRouter();
  const [scan, setScan] = useState(initialScan);
  const [issueCounts, setIssueCounts] = useState(initialIssueCounts);
  const [activeCategory, setActiveCategory] = useState<string>("AppDebug");
  const [openIssueId, setOpenIssueId] = useState<number | null>(null);
  const inFlight = ["Pending", "Queued", "Running"].includes(scan.Status);

  const { rows, pagination, loading, page, setPage } = useLaravelSecurityList<IssueRow>("/api/admin/laravel-security/issues", {
    scanId: String(scan.Id),
    category: activeCategory,
  });

  async function refreshIssueCounts() {
    const res = await fetch(`/api/admin/laravel-security/scans/${scan.Id}`).then((r) => r.json());
    // The API groups by Category + Severity (for a future severity breakdown) - collapse to a
    // per-category total here, same reduce-merge Code Quality's ScanDetailClient uses for its
    // (category-only) issueCounts.
    if (res.ok) setIssueCounts(res.data.issueCounts.reduce((acc: IssueCount[], row: { Category: string; Cnt: number }) => {
      const existing = acc.find((a) => a.Category === row.Category);
      if (existing) existing.Cnt += row.Cnt; else acc.push({ Category: row.Category, Cnt: row.Cnt });
      return acc;
    }, [] as IssueCount[]));
  }

  useEffect(() => {
    if (!inFlight) void refreshIssueCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan.Status]);

  const columns: LsTableColumn<IssueRow>[] = [
    { key: "Title", label: "Issue", render: (r) => (
      <button type="button" onClick={() => setOpenIssueId(r.Id)} style={{ background: "none", border: "none", padding: 0, color: "var(--primary)", cursor: "pointer", textAlign: "left", fontSize: "0.85rem" }}>
        {r.Title}
      </button>
    ) },
    { key: "FilePath", label: "File", render: (r) => <span style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{r.FilePath}</span> },
    { key: "StartLine", label: "Line", render: (r) => r.StartLine ?? "—" },
    { key: "Severity", label: "Severity", sortable: true, render: (r) => <SeverityBadge severity={r.Severity} /> },
    { key: "Status", label: "Status", render: (r) => r.Status },
    { key: "ConfidenceLevel", label: "Confidence", render: (r) => r.ConfidenceLevel ?? "—" },
  ];

  return (
    <div className="flex flex-col" style={{ gap: "1rem" }}>
      <div className="flex items-center justify-between flex-wrap" style={{ gap: "0.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>
            Scan #{scan.Id} — {scan.ProjectName}
          </h1>
          <p style={{ margin: "0.2rem 0 0", color: "var(--ink-muted)", fontSize: "0.85rem" }}>Branch: {scan.Branch || "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          <ScanStatusBadge status={scan.Status} />
          {can.ls_export && (
            <Button variant="secondary" onClick={() => window.open(`/api/admin/laravel-security/scans/${scan.Id}/export?format=csv`, "_blank")}>
              <Download size={14} /> Export
            </Button>
          )}
        </div>
      </div>

      {scan.ErrorMessage && (
        <div style={{ padding: "0.7rem 0.9rem", borderRadius: 8, background: "color-mix(in srgb, var(--danger) 15%, transparent)", color: "var(--danger)", fontSize: "0.82rem" }}>
          {scan.ErrorMessage}
        </div>
      )}

      {inFlight && <ScanProgress scanId={scan.Id} onScanUpdate={(s) => { setScan(s); if (!["Pending", "Queued", "Running"].includes(s.Status)) router.refresh(); }} />}

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <Card style={{ padding: "0.85rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>Started By</div>
          <div>{scan.StartedByUsername || "—"}</div>
        </Card>
        <Card style={{ padding: "0.85rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>Duration</div>
          <div>{formatDuration(scan.DurationMs)}</div>
        </Card>
        <Card style={{ padding: "0.85rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>Files Scanned</div>
          <div>{scan.FilesScanned.toLocaleString()}</div>
        </Card>
        <Card style={{ padding: "0.85rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>Security Score</div>
          <SecurityScoreBadge score={scan.SecurityScore} />
        </Card>
        <Card style={{ padding: "0.85rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>Total Issues</div>
          <div>{issueCounts.reduce((sum, c) => sum + c.Cnt, 0)}</div>
        </Card>
      </div>

      <div className="flex items-center gap-2 flex-wrap" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
        {SECTIONS.map((s) => {
          const count = issueCounts.find((c) => c.Category === s.category)?.Cnt ?? 0;
          return (
            <button
              key={s.category}
              type="button"
              onClick={() => {
                setActiveCategory(s.category);
                setPage(1);
              }}
              style={{
                padding: "0.4rem 0.75rem",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: activeCategory === s.category ? "var(--primary)" : "var(--surface-2)",
                color: activeCategory === s.category ? "#fff" : "var(--ink)",
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              {s.label} ({count})
            </button>
          );
        })}
      </div>

      <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: "0.82rem" }}>{SECTIONS.find((s) => s.category === activeCategory)?.description}</p>

      <LaravelSecurityTable
        storageKey={`scan-issues-${activeCategory}`}
        columns={columns}
        rows={rows}
        getRowId={(r) => r.Id}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage="No issues in this category."
      />

      {openIssueId !== null && <IssueDetailsDrawer issueId={openIssueId} onClose={() => setOpenIssueId(null)} canUpdate={can.ls_issue_update} onUpdated={refreshIssueCounts} />}
    </div>
  );
}
