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
import { BUG_STATUS_TONE, PRIORITY_TONE, toneFor } from "@/lib/qaBadgeTones";

interface UserOption { Id: number; Username: string }
interface Prefill { testCaseId: number; projectId: number | null; testRunId: number | null }

interface BugRow {
  Id: number;
  BugNumber: string;
  Title: string;
  ProjectId: number;
  Severity: string;
  Priority: string;
  Status: string;
  AssignedDeveloperUserId: number | null;
  CreatedAt: string;
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)" };
const labelStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--ink-muted)", display: "block", marginBottom: 4 };
const STATUSES = ["New", "Open", "In Progress", "Resolved", "Ready for Retest", "Verified", "Closed", "Rejected", "Duplicate", "Reopened"];
const SEVERITIES = ["Low", "Medium", "High", "Critical"];

function BugsInner({
  projects: initialProjects, users, prefill, canCreate,
}: {
  projects: QaProjectOption[];
  users: UserOption[];
  prefill: Prefill | null;
  canCreate: boolean;
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [filterProjectId, setFilterProjectId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(!!prefill);

  const { rows, pagination, loading, page, setPage, sortBy, sortDir, onSortChange, reload } = useQaList<BugRow>(
    "/api/admin/qa/bugs",
    {
      projectId: filterProjectId ? String(filterProjectId) : undefined,
      status: filterStatus || undefined,
      severity: filterSeverity || undefined,
      search: search || undefined,
    },
    25
  );

  const columns: QaTableColumn<BugRow>[] = [
    {
      key: "BugNumber", label: "Bug", sortable: true,
      render: (r) => <Link href={`/dashboard/qa/bugs/${r.Id}`} style={{ color: "var(--primary)", fontFamily: "monospace" }}>{r.BugNumber}</Link>,
    },
    { key: "Title", label: "Title", sortable: true, render: (r) => r.Title },
    { key: "Project", label: "Project", render: (r) => projects.find((p) => p.Id === r.ProjectId)?.Name ?? "—" },
    { key: "Severity", label: "Severity", sortable: true, render: (r) => <Badge tone={toneFor(PRIORITY_TONE, r.Severity)}>{r.Severity}</Badge> },
    { key: "Priority", label: "Priority", sortable: true, render: (r) => <Badge tone={toneFor(PRIORITY_TONE, r.Priority)}>{r.Priority}</Badge> },
    { key: "Status", label: "Status", sortable: true, render: (r) => <Badge tone={toneFor(BUG_STATUS_TONE, r.Status)}>{r.Status}</Badge> },
    { key: "AssignedTo", label: "Assigned To", render: (r) => users.find((u) => u.Id === r.AssignedDeveloperUserId)?.Username ?? "Unassigned" },
    { key: "CreatedAt", label: "Filed", sortable: true, hideByDefault: true, render: (r) => new Date(r.CreatedAt).toLocaleDateString() },
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
          <div style={{ width: 140 }}>
            <Select value={filterSeverity} onChange={(v) => { setFilterSeverity(v); setPage(1); }} placeholder="All severities" options={SEVERITIES.map((s) => ({ label: s, value: s }))} />
          </div>
          <input placeholder="Search bugs..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ ...inputStyle, width: 200 }} />
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setCreating(true)}><Plus size={14} /> File Bug</Button>
        )}
      </div>

      <QaTable
        storageKey="bugs"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.Id}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={onSortChange}
        emptyMessage="No bugs filed yet."
      />

      {creating && (
        <CreateBugModal
          projects={projects}
          prefill={prefill}
          onProjectCreated={(p) => setProjects((prev) => [...prev, p])}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); reload(); }}
        />
      )}
    </>
  );
}

function CreateBugModal({
  projects, prefill, onProjectCreated, onClose, onCreated,
}: {
  projects: QaProjectOption[];
  prefill: Prefill | null;
  onProjectCreated: (p: QaProjectOption) => void;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [projectId, setProjectId] = useState<number | null>(prefill?.projectId ?? null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [actualResult, setActualResult] = useState("");
  const [severity, setSeverity] = useState("Medium");
  const [priority, setPriority] = useState("Medium");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!projectId) return toast.show({ type: "error", message: "Select a project first." });
    if (!title.trim()) return toast.show({ type: "error", message: "Title is required." });
    setSaving(true);
    try {
      const res = await fetch("/api/admin/qa/bugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId, title, description, stepsToReproduce, expectedResult, actualResult, severity, priority,
          testCaseId: prefill?.testCaseId, testRunId: prefill?.testRunId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to file bug.");
      toast.show({ type: "success", message: `Bug ${data.data.BugNumber} filed.` });
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
      title="File a Bug"
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving}>{saving ? "Filing..." : "File Bug"}</Button>
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
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div>
          <label style={labelStyle}>Steps to Reproduce</label>
          <textarea value={stepsToReproduce} onChange={(e) => setStepsToReproduce(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div>
            <label style={labelStyle}>Expected Result</label>
            <textarea value={expectedResult} onChange={(e) => setExpectedResult(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div>
            <label style={labelStyle}>Actual Result</label>
            <textarea value={actualResult} onChange={(e) => setActualResult(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <div>
            <label style={labelStyle}>Severity</label>
            <Select value={severity} onChange={setSeverity} options={SEVERITIES.map((s) => ({ label: s, value: s }))} />
          </div>
          <div>
            <label style={labelStyle}>Priority</label>
            <Select value={priority} onChange={setPriority} options={SEVERITIES.map((s) => ({ label: s, value: s }))} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function BugsClient(props: { projects: QaProjectOption[]; users: UserOption[]; prefill: Prefill | null; canCreate: boolean }) {
  return (
    <ToastProvider>
      <BugsInner {...props} />
    </ToastProvider>
  );
}
