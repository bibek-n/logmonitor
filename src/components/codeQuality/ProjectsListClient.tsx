"use client";

import { useState } from "react";
import { Play, Eye, Pencil, Trash2, History } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { CodeQualityTable, type CqTableColumn } from "./CodeQualityTable";
import { useCodeQualityList } from "@/hooks/useCodeQualityList";
import { QualityScoreBadge, ScanStatusBadge } from "./badges";
import { StartScanModal } from "./StartScanModal";

interface ProjectRow {
  Id: number;
  Name: string;
  SourcePath: string;
  Language: string | null;
  Status: string;
  LastScanDate: string | null;
  LastScanStatus: string | null;
  QualityScore: number | null;
  TotalIssues: number;
}

export function ProjectsListClient({ can }: { can: Record<string, boolean> }) {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [scanTarget, setScanTarget] = useState<ProjectRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { rows, pagination, loading, page, setPage, sortBy, sortDir, onSortChange, reload } = useCodeQualityList<ProjectRow>(
    "/api/admin/code-quality/projects",
    { search: search || undefined, status: status || undefined }
  );

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/code-quality/projects/${deleteTarget.Id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to delete project.");
      toast.show({ type: "success", message: `"${deleteTarget.Name}" deleted.` });
      setDeleteTarget(null);
      reload();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to delete project." });
    } finally {
      setDeleting(false);
    }
  }

  const columns: CqTableColumn<ProjectRow>[] = [
    { key: "Name", label: "Project Name", sortable: true, render: (r) => <Link href={`/dashboard/code-quality/projects/${r.Id}`} style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}>{r.Name}</Link> },
    { key: "SourcePath", label: "Source Path", render: (r) => <span style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{r.SourcePath}</span> },
    { key: "Language", label: "Language", sortable: true, render: (r) => r.Language ?? "—" },
    { key: "LastScanDate", label: "Last Scan Date", render: (r) => (r.LastScanDate ? new Date(r.LastScanDate).toLocaleString() : "Never") },
    { key: "LastScanStatus", label: "Last Scan Status", render: (r) => (r.LastScanStatus ? <ScanStatusBadge status={r.LastScanStatus} /> : "—") },
    { key: "QualityScore", label: "Quality Score", render: (r) => <QualityScoreBadge score={r.QualityScore} /> },
    { key: "TotalIssues", label: "Total Issues", render: (r) => r.TotalIssues },
    { key: "Status", label: "Status", sortable: true, render: (r) => (r.Status === "Active" ? <span style={{ color: "var(--success)" }}>Active</span> : <span style={{ color: "var(--ink-muted)" }}>Inactive</span>) },
  ];

  return (
    <div className="flex flex-col" style={{ gap: "1rem" }}>
      <div className="flex items-center justify-between">
        <h1 style={{ margin: 0, fontSize: "1.4rem" }}>Projects</h1>
        {can.cq_project_create && (
          <Link href="/dashboard/code-quality/projects/new" style={{ padding: "0.55rem 1rem", borderRadius: 8, background: "var(--primary)", color: "#fff", textDecoration: "none", fontSize: "0.85rem", fontWeight: 600 }}>
            Add Project
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or path…"
          style={{ padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.85rem", minWidth: 240 }}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.85rem" }}>
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      <CodeQualityTable
        storageKey="projects"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.Id}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={onSortChange}
        emptyMessage="No projects yet. Add one to run your first scan."
        rowActions={(r) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/code-quality/projects/${r.Id}`)} title="View">
              <Eye size={14} />
            </Button>
            {can.cq_project_update && (
              <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/code-quality/projects/${r.Id}/edit`)} title="Edit">
                <Pencil size={14} />
              </Button>
            )}
            {can.cq_scan_start && (
              <Button variant="ghost" size="sm" onClick={() => setScanTarget(r)} title="Start Scan">
                <Play size={14} />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/code-quality/scans?projectId=${r.Id}`)} title="View Scan History">
              <History size={14} />
            </Button>
            {can.cq_project_delete && (
              <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(r)} title="Delete">
                <Trash2 size={14} style={{ color: "var(--danger)" }} />
              </Button>
            )}
          </div>
        )}
      />

      {scanTarget && (
        <StartScanModal
          projectId={scanTarget.Id}
          projectName={scanTarget.Name}
          open={!!scanTarget}
          onClose={() => setScanTarget(null)}
          onStarted={(scanId) => router.push(`/dashboard/code-quality/scans/${scanId}`)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete project?"
        message={`This removes "${deleteTarget?.Name}" from Code Quality. Its scan history is kept for audit purposes.`}
        confirmLabel="Delete"
        tone="danger"
        loading={deleting}
      />
    </div>
  );
}
