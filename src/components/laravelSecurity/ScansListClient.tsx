"use client";

import { useState } from "react";
import { Eye, XCircle, RotateCcw, Download, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { LaravelSecurityTable, type LsTableColumn } from "./LaravelSecurityTable";
import { useLaravelSecurityList } from "@/hooks/useLaravelSecurityList";
import { SecurityScoreBadge, ScanStatusBadge } from "./badges";

interface ScanRow {
  Id: number;
  ProjectId: number;
  ProjectName: string;
  Branch: string | null;
  Status: string;
  StartedByUsername: string | null;
  StartedAt: string | null;
  CompletedAt: string | null;
  DurationMs: number | null;
  SecurityScore: number | null;
  TotalIssues: number;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export function ScansListClient({ can, initialProjectId }: { can: Record<string, boolean>; initialProjectId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState("");
  const [cancelTarget, setCancelTarget] = useState<ScanRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScanRow | null>(null);
  const [busy, setBusy] = useState(false);

  const { rows, pagination, loading, page, setPage, sortBy, sortDir, onSortChange, reload } = useLaravelSecurityList<ScanRow>(
    "/api/admin/laravel-security/scans",
    { projectId: initialProjectId, status: status || undefined }
  );

  async function handleCancel() {
    if (!cancelTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/laravel-security/scans/${cancelTarget.Id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to cancel scan.");
      toast.show({ type: "success", message: "Scan cancellation requested." });
      setCancelTarget(null);
      reload();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to cancel scan." });
    } finally {
      setBusy(false);
    }
  }

  async function handleRetry(scan: ScanRow) {
    try {
      const res = await fetch(`/api/admin/laravel-security/scans/${scan.Id}/retry`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to retry scan.");
      toast.show({ type: "success", message: "New scan started." });
      router.push(`/dashboard/laravel-security/scans/${data.data.scanId}`);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to retry scan." });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/laravel-security/scans/${deleteTarget.Id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to delete scan record.");
      toast.show({ type: "success", message: "Scan record deleted." });
      setDeleteTarget(null);
      reload();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to delete scan record." });
    } finally {
      setBusy(false);
    }
  }

  const columns: LsTableColumn<ScanRow>[] = [
    { key: "Id", label: "Scan ID", sortable: false, render: (r) => `#${r.Id}` },
    { key: "ProjectName", label: "Project", render: (r) => r.ProjectName },
    { key: "Branch", label: "Branch", render: (r) => r.Branch || "—" },
    { key: "StartedByUsername", label: "Started By", render: (r) => r.StartedByUsername || "—" },
    { key: "StartedAt", label: "Start Time", sortable: true, render: (r) => (r.StartedAt ? new Date(r.StartedAt).toLocaleString() : "—") },
    { key: "CompletedAt", label: "Completion Time", sortable: true, render: (r) => (r.CompletedAt ? new Date(r.CompletedAt).toLocaleString() : "—") },
    { key: "DurationMs", label: "Duration", render: (r) => formatDuration(r.DurationMs) },
    { key: "Status", label: "Status", sortable: true, render: (r) => <ScanStatusBadge status={r.Status} /> },
    { key: "SecurityScore", label: "Security Score", sortable: true, render: (r) => <SecurityScoreBadge score={r.SecurityScore} /> },
    { key: "TotalIssues", label: "Total Issues", render: (r) => r.TotalIssues },
  ];

  return (
    <div className="flex flex-col" style={{ gap: "1rem" }}>
      <h1 style={{ margin: 0, fontSize: "1.4rem" }}>Scan History</h1>

      <div className="flex items-center gap-2 flex-wrap">
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.85rem" }}>
          <option value="">All statuses</option>
          {["Pending", "Queued", "Running", "Completed", "PartiallyCompleted", "Failed", "Cancelled"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <LaravelSecurityTable
        storageKey="scans"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.Id}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={onSortChange}
        emptyMessage="No scans yet."
        rowActions={(r) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/laravel-security/scans/${r.Id}`)} title="View Results">
              <Eye size={14} />
            </Button>
            {can.ls_scan_cancel && ["Pending", "Queued", "Running"].includes(r.Status) && (
              <Button variant="ghost" size="sm" onClick={() => setCancelTarget(r)} title="Cancel Scan">
                <XCircle size={14} style={{ color: "var(--warning)" }} />
              </Button>
            )}
            {can.ls_scan_start && (
              <Button variant="ghost" size="sm" onClick={() => handleRetry(r)} title="Retry Scan">
                <RotateCcw size={14} />
              </Button>
            )}
            {can.ls_export && (
              <Button variant="ghost" size="sm" onClick={() => window.open(`/api/admin/laravel-security/scans/${r.Id}/export?format=csv`, "_blank")} title="Export Results">
                <Download size={14} />
              </Button>
            )}
            {can.ls_project_delete && !["Pending", "Queued", "Running"].includes(r.Status) && (
              <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(r)} title="Delete Scan Record">
                <Trash2 size={14} style={{ color: "var(--danger)" }} />
              </Button>
            )}
          </div>
        )}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        title="Cancel scan?"
        message={`Scan #${cancelTarget?.Id} will stop at its next checkpoint and be marked Cancelled.`}
        confirmLabel="Cancel Scan"
        tone="danger"
        loading={busy}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete scan record?"
        message={`This permanently removes scan #${deleteTarget?.Id} and its issues/metrics.`}
        confirmLabel="Delete"
        tone="danger"
        loading={busy}
      />
    </div>
  );
}
