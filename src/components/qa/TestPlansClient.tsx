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
import { TEST_RUN_STATUS_TONE, toneFor } from "@/lib/qaBadgeTones";

interface QaReleaseOption { Id: number; ProjectId: number; Name: string }

interface TestPlanRow {
  Id: number; TestPlanNumber: string; ProjectId: number; ReleaseId: number | null; Name: string;
  Status: string; CreatedAt: string;
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)" };
const labelStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--ink-muted)", display: "block", marginBottom: 4 };
const STATUSES = ["Planned", "In Progress", "Paused", "Completed", "Cancelled"];

function Inner({ projects: initialProjects, releases, canManage }: { projects: QaProjectOption[]; releases: QaReleaseOption[]; canManage: boolean }) {
  const toast = useToast();
  const [projects, setProjects] = useState(initialProjects);
  const [filterProjectId, setFilterProjectId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const { rows, pagination, loading, page, setPage, sortBy, sortDir, onSortChange, reload } = useQaList<TestPlanRow>(
    "/api/admin/qa/test-plans",
    { projectId: filterProjectId ? String(filterProjectId) : undefined, status: filterStatus || undefined, search: search || undefined },
    25
  );

  const columns: QaTableColumn<TestPlanRow>[] = [
    {
      key: "TestPlanNumber", label: "Plan", sortable: true,
      render: (r) => <Link href={`/dashboard/qa/test-plans/${r.Id}`} style={{ color: "var(--primary)", fontFamily: "monospace" }}>{r.TestPlanNumber}</Link>,
    },
    { key: "Name", label: "Name", sortable: true, render: (r) => r.Name },
    { key: "Project", label: "Project", render: (r) => projects.find((p) => p.Id === r.ProjectId)?.Name ?? "—" },
    { key: "Release", label: "Release", render: (r) => releases.find((rel) => rel.Id === r.ReleaseId)?.Name ?? "—" },
    { key: "Status", label: "Status", sortable: true, render: (r) => <Badge tone={toneFor(TEST_RUN_STATUS_TONE, r.Status)}>{r.Status}</Badge> },
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
          <input placeholder="Search test plans..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ ...inputStyle, width: 200 }} />
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreating(true)}><Plus size={14} /> New Test Plan</Button>
        )}
      </div>

      <QaTable
        storageKey="test-plans"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.Id}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={onSortChange}
        emptyMessage="No test plans yet."
      />

      {creating && (
        <CreateTestPlanModal
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

function CreateTestPlanModal({
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
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const releasesForProject = releases.filter((r) => r.ProjectId === projectId);

  async function submit() {
    if (!projectId) return toast.show({ type: "error", message: "Select a project first." });
    if (!name.trim()) return toast.show({ type: "error", message: "Name is required." });
    setSaving(true);
    try {
      const res = await fetch("/api/admin/qa/test-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, releaseId, name, description }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to create test plan.");
      toast.show({ type: "success", message: `Test plan ${data.data.TestPlanNumber} created.` });
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
      title="New Test Plan"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving}>{saving ? "Creating..." : "Create Test Plan"}</Button>
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
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
      </div>
    </Modal>
  );
}

export function TestPlansClient(props: { projects: QaProjectOption[]; releases: QaReleaseOption[]; canManage: boolean }) {
  return (
    <ToastProvider>
      <Inner {...props} />
    </ToastProvider>
  );
}
