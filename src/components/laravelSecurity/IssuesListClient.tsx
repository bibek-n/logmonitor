"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LaravelSecurityTable, type LsTableColumn } from "./LaravelSecurityTable";
import { useLaravelSecurityList } from "@/hooks/useLaravelSecurityList";
import { CategoryBadge, IssueStatusBadge, SeverityBadge } from "./badges";
import { IssueDetailsDrawer } from "./IssueDetailsDrawer";

interface IssueRow {
  Id: number;
  IssueNumber: string | null;
  Title: string;
  Category: string;
  ProjectId: number;
  ProjectName: string;
  FilePath: string;
  StartLine: number | null;
  Severity: string;
  Status: string;
  ScanId: number;
  CreatedAt: string;
}

const fieldStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

const CATEGORIES = ["AppDebug", "AppKey", "DotEnv", "Csrf", "MassAssignment", "Validation", "Sanitization", "StorageLinks", "Queue"];

export function IssuesListClient({ can, projects }: { can: Record<string, boolean>; projects: { Id: number; Name: string }[] }) {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [projectId, setProjectId] = useState("");
  const [scanId, setScanId] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [rule, setRule] = useState("");
  const [filePath, setFilePath] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [openIssueId, setOpenIssueId] = useState<number | null>(null);

  useEffect(() => {
    const fromQuery = searchParams.get("openIssue");
    if (fromQuery) {
      const parsed = Number(fromQuery);
      if (Number.isInteger(parsed) && parsed > 0) setOpenIssueId(parsed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { rows, pagination, loading, page, setPage, sortBy, sortDir, onSortChange, reload } = useLaravelSecurityList<IssueRow>("/api/admin/laravel-security/issues", {
    search: search || undefined,
    projectId: projectId || undefined,
    scanId: scanId || undefined,
    category: category || undefined,
    severity: severity || undefined,
    status: status || undefined,
    rule: rule || undefined,
    filePath: filePath || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  function resetToFirstPage<T extends (v: string) => void>(setter: T) {
    return (v: string) => {
      setter(v);
      setPage(1);
    };
  }

  const columns: LsTableColumn<IssueRow>[] = [
    { key: "Title", label: "Issue", render: (r) => (
      <button type="button" onClick={() => setOpenIssueId(r.Id)} style={{ background: "none", border: "none", padding: 0, color: "var(--primary)", cursor: "pointer", textAlign: "left", fontSize: "0.85rem" }}>
        {r.Title}
      </button>
    ) },
    { key: "Category", label: "Category", render: (r) => <CategoryBadge category={r.Category} /> },
    { key: "ProjectName", label: "Project", render: (r) => r.ProjectName },
    { key: "FilePath", label: "File", render: (r) => <span style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{r.FilePath}</span> },
    { key: "StartLine", label: "Line", render: (r) => r.StartLine ?? "—" },
    { key: "Severity", label: "Severity", sortable: true, render: (r) => <SeverityBadge severity={r.Severity} /> },
    { key: "Status", label: "Status", sortable: true, render: (r) => <IssueStatusBadge status={r.Status} /> },
    { key: "CreatedAt", label: "Detected Date", sortable: true, render: (r) => new Date(r.CreatedAt).toLocaleDateString() },
  ];

  return (
    <div className="flex flex-col" style={{ gap: "1rem" }}>
      <h1 style={{ margin: 0, fontSize: "1.4rem" }}>Issues</h1>

      <div className="flex flex-col gap-2">
        <input
          value={search}
          onChange={(e) => resetToFirstPage(setSearch)(e.target.value)}
          placeholder="Search file, code element, rule, or description…"
          style={{ ...fieldStyle, width: "100%", maxWidth: 480 }}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <select value={projectId} onChange={(e) => resetToFirstPage(setProjectId)(e.target.value)} style={fieldStyle}>
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.Id} value={p.Id}>{p.Name}</option>
            ))}
          </select>
          <select value={category} onChange={(e) => resetToFirstPage(setCategory)(e.target.value)} style={fieldStyle}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={severity} onChange={(e) => resetToFirstPage(setSeverity)(e.target.value)} style={fieldStyle}>
            <option value="">All severities</option>
            {["Low", "Medium", "High", "Critical"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => resetToFirstPage(setStatus)(e.target.value)} style={fieldStyle}>
            <option value="">All statuses</option>
            {["Open", "Confirmed", "Resolved", "Ignored", "FalsePositive"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input value={rule} onChange={(e) => resetToFirstPage(setRule)(e.target.value)} placeholder="Rule code" style={{ ...fieldStyle, width: 150 }} />
          <input value={scanId} onChange={(e) => resetToFirstPage(setScanId)(e.target.value)} placeholder="Scan ID" style={{ ...fieldStyle, width: 90 }} />
          <input value={filePath} onChange={(e) => resetToFirstPage(setFilePath)(e.target.value)} placeholder="File path contains…" style={{ ...fieldStyle, width: 180 }} />
          <input type="date" value={dateFrom} onChange={(e) => resetToFirstPage(setDateFrom)(e.target.value)} style={fieldStyle} />
          <input type="date" value={dateTo} onChange={(e) => resetToFirstPage(setDateTo)(e.target.value)} style={fieldStyle} />
        </div>
      </div>

      <LaravelSecurityTable
        storageKey="issues"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.Id}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={onSortChange}
        emptyMessage="No issues match these filters."
      />

      {openIssueId !== null && (
        <IssueDetailsDrawer issueId={openIssueId} onClose={() => setOpenIssueId(null)} canUpdate={can.ls_issue_update} onUpdated={reload} />
      )}
    </div>
  );
}
