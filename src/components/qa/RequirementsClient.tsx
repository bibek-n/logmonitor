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
import { PRIORITY_TONE, toneFor } from "@/lib/qaBadgeTones";

interface RequirementRow {
  Id: number; RequirementNumber: string; ProjectId: number; Title: string; Category: string | null;
  Priority: string; Status: string; CreatedAt: string;
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)" };
const labelStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--ink-muted)", display: "block", marginBottom: 4 };
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const STATUSES = ["New", "Approved", "Implemented", "Verified", "Deprecated"];
const REQUIREMENT_STATUS_TONE: Record<string, "success" | "info" | "warning" | "neutral"> = {
  New: "neutral", Approved: "info", Implemented: "warning", Verified: "success", Deprecated: "neutral",
};

function Inner({ projects: initialProjects, canManage }: { projects: QaProjectOption[]; canManage: boolean }) {
  const toast = useToast();
  const [projects, setProjects] = useState(initialProjects);
  const [filterProjectId, setFilterProjectId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const { rows, pagination, loading, page, setPage, sortBy, sortDir, onSortChange, reload } = useQaList<RequirementRow>(
    "/api/admin/qa/requirements",
    { projectId: filterProjectId ? String(filterProjectId) : undefined, status: filterStatus || undefined, search: search || undefined },
    25
  );

  const columns: QaTableColumn<RequirementRow>[] = [
    {
      key: "RequirementNumber", label: "Requirement", sortable: true,
      render: (r) => <Link href={`/dashboard/qa/requirements/${r.Id}`} style={{ color: "var(--primary)", fontFamily: "monospace" }}>{r.RequirementNumber}</Link>,
    },
    { key: "Title", label: "Title", sortable: true, render: (r) => r.Title },
    { key: "Project", label: "Project", render: (r) => projects.find((p) => p.Id === r.ProjectId)?.Name ?? "—" },
    { key: "Category", label: "Category", render: (r) => r.Category ?? "—" },
    { key: "Priority", label: "Priority", sortable: true, render: (r) => <Badge tone={toneFor(PRIORITY_TONE, r.Priority)}>{r.Priority}</Badge> },
    { key: "Status", label: "Status", sortable: true, render: (r) => <Badge tone={REQUIREMENT_STATUS_TONE[r.Status] ?? "neutral"}>{r.Status}</Badge> },
    { key: "CreatedAt", label: "Created", sortable: true, hideByDefault: true, render: (r) => new Date(r.CreatedAt).toLocaleDateString() },
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
          <input placeholder="Search requirements..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ ...inputStyle, width: 220 }} />
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/qa/requirements/traceability" style={{ fontSize: "0.82rem", color: "var(--primary)" }}>
            Traceability Matrix →
          </Link>
          {canManage && (
            <Button size="sm" onClick={() => setCreating(true)}><Plus size={14} /> New Requirement</Button>
          )}
        </div>
      </div>

      <QaTable
        storageKey="requirements"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.Id}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={onSortChange}
        emptyMessage="No requirements yet."
      />

      {creating && (
        <CreateRequirementModal
          projects={projects}
          onProjectCreated={(p) => setProjects((prev) => [...prev, p])}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); reload(); }}
        />
      )}
    </>
  );
}

function CreateRequirementModal({
  projects, onProjectCreated, onClose, onCreated,
}: {
  projects: QaProjectOption[];
  onProjectCreated: (p: QaProjectOption) => void;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!projectId) return toast.show({ type: "error", message: "Select a project first." });
    if (!title.trim()) return toast.show({ type: "error", message: "Title is required." });
    setSaving(true);
    try {
      const res = await fetch("/api/admin/qa/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, title, description, category, priority }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to create requirement.");
      toast.show({ type: "success", message: `Requirement ${data.data.RequirementNumber} created.` });
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
      title="New Requirement"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving}>{saving ? "Creating..." : "Create Requirement"}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <label style={labelStyle}>Project</label>
          <ProjectSelect projects={projects} value={projectId} onChange={setProjectId} onProjectCreated={onProjectCreated} />
        </div>
        <div>
          <label style={labelStyle}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <div>
            <label style={labelStyle}>Category</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} maxLength={50} style={inputStyle} placeholder="Functional, Business, Compliance..." />
          </div>
          <div>
            <label style={labelStyle}>Priority</label>
            <Select value={priority} onChange={setPriority} options={PRIORITIES.map((p) => ({ label: p, value: p }))} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function RequirementsClient(props: { projects: QaProjectOption[]; canManage: boolean }) {
  return (
    <ToastProvider>
      <Inner {...props} />
    </ToastProvider>
  );
}
