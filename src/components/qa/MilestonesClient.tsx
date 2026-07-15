"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { QaTable, type QaTableColumn } from "@/components/qa/QaTable";
import { useQaList } from "@/components/qa/useQaList";
import { ProjectSelect, type QaProjectOption } from "@/components/qa/ProjectSelect";

interface QaReleaseOption { Id: number; ProjectId: number; Name: string }

interface MilestoneRow {
  Id: number; ProjectId: number; ReleaseId: number | null; Name: string; MilestoneType: string;
  DueDate: string | null; Status: string; CreatedAt: string;
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)" };
const labelStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--ink-muted)", display: "block", marginBottom: 4 };
const STATUSES = ["Planned", "In Progress", "Completed", "Missed"];
const TYPES = ["Sprint", "Release Milestone"];
const STATUS_TONE: Record<string, "success" | "info" | "danger" | "neutral"> = {
  Planned: "neutral", "In Progress": "info", Completed: "success", Missed: "danger",
};

function Inner({ projects: initialProjects, releases, canManage }: { projects: QaProjectOption[]; releases: QaReleaseOption[]; canManage: boolean }) {
  const toast = useToast();
  const [projects, setProjects] = useState(initialProjects);
  const [filterProjectId, setFilterProjectId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const { rows, pagination, loading, page, setPage, sortBy, sortDir, onSortChange, reload } = useQaList<MilestoneRow>(
    "/api/admin/qa/milestones",
    { projectId: filterProjectId ? String(filterProjectId) : undefined, status: filterStatus || undefined, search: search || undefined },
    25
  );

  const columns: QaTableColumn<MilestoneRow>[] = [
    {
      key: "Name", label: "Milestone", sortable: true,
      render: (r) => <Link href={`/dashboard/qa/milestones/${r.Id}`} style={{ color: "var(--primary)" }}>{r.Name}</Link>,
    },
    { key: "Project", label: "Project", render: (r) => projects.find((p) => p.Id === r.ProjectId)?.Name ?? "—" },
    { key: "MilestoneType", label: "Type", sortable: true, render: (r) => r.MilestoneType },
    { key: "Release", label: "Release", render: (r) => releases.find((rel) => rel.Id === r.ReleaseId)?.Name ?? "—" },
    { key: "DueDate", label: "Due", sortable: true, render: (r) => r.DueDate ?? "—" },
    { key: "Status", label: "Status", sortable: true, render: (r) => <Badge tone={STATUS_TONE[r.Status] ?? "neutral"}>{r.Status}</Badge> },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-3" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
          <div style={{ width: 180 }}>
            <Select value={filterProjectId ? String(filterProjectId) : ""} onChange={(v) => { setFilterProjectId(v ? Number(v) : null); setPage(1); }} placeholder="All projects" options={projects.map((p) => ({ label: p.Name, value: String(p.Id) }))} />
          </div>
          <div style={{ width: 160 }}>
            <Select value={filterStatus} onChange={(v) => { setFilterStatus(v); setPage(1); }} placeholder="All statuses" options={STATUSES.map((s) => ({ label: s, value: s }))} />
          </div>
          <input placeholder="Search milestones..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ ...inputStyle, width: 200 }} />
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreating(true)}><Plus size={14} /> New Milestone</Button>
        )}
      </div>

      <QaTable
        storageKey="milestones"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.Id}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={onSortChange}
        emptyMessage="No milestones yet."
      />

      {creating && (
        <CreateMilestoneModal
          projects={projects}
          releases={releases}
          onProjectCreated={(p) => setProjects((prev) => [...prev, p])}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); reload(); }}
        />
      )}
    </>
  );
}

function CreateMilestoneModal({
  projects, releases, onProjectCreated, onClose, onCreated,
}: {
  projects: QaProjectOption[];
  releases: QaReleaseOption[];
  onProjectCreated: (p: QaProjectOption) => void;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [releaseId, setReleaseId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [milestoneType, setMilestoneType] = useState("Sprint");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const releasesForProject = releases.filter((r) => r.ProjectId === projectId);

  async function submit() {
    if (!projectId) return toast.show({ type: "error", message: "Select a project first." });
    if (!name.trim()) return toast.show({ type: "error", message: "Name is required." });
    setSaving(true);
    try {
      const res = await fetch("/api/admin/qa/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, releaseId, name, milestoneType, dueDate: dueDate || null, description }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to create milestone.");
      toast.show({ type: "success", message: `Milestone "${data.data.Name}" created.` });
      onCreated();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New Milestone"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving}>{saving ? "Creating..." : "Create Milestone"}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <label style={labelStyle}>Project</label>
          <ProjectSelect projects={projects} value={projectId} onChange={setProjectId} onProjectCreated={onProjectCreated} />
        </div>
        {projectId && releasesForProject.length > 0 && (
          <div>
            <label style={labelStyle}>Release (optional)</label>
            <Select value={releaseId ? String(releaseId) : ""} onChange={(v) => setReleaseId(v ? Number(v) : null)} placeholder="No release" options={releasesForProject.map((r) => ({ label: r.Name, value: String(r.Id) }))} />
          </div>
        )}
        <div>
          <label style={labelStyle}>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} style={inputStyle} placeholder="Sprint 14, v2.0 GA..." />
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <div>
            <label style={labelStyle}>Type</label>
            <Select value={milestoneType} onChange={setMilestoneType} options={TYPES.map((t) => ({ label: t, value: t }))} />
          </div>
          <div>
            <label style={labelStyle}>Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
      </div>
    </Modal>
  );
}

export function MilestonesClient(props: { projects: QaProjectOption[]; releases: QaReleaseOption[]; canManage: boolean }) {
  return (
    <ToastProvider>
      <Inner {...props} />
    </ToastProvider>
  );
}
