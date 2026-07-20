"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Archive, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { QaTable, type QaTableColumn } from "@/components/qa/QaTable";
import { useQaList } from "@/components/qa/useQaList";
import { ProjectSelect, type QaProjectOption } from "@/components/qa/ProjectSelect";
import { TEST_SUITE_STATUS_TONE, toneFor } from "@/lib/qaBadgeTones";

export interface QaModuleOption {
  Id: number;
  ProjectId: number;
  Name: string;
}

export interface TestSuiteRow {
  Id: number;
  ProjectId: number;
  ModuleId: number | null;
  Name: string;
  Description: string | null;
  RequirementRef: string | null;
  Status: string;
  CreatedAt: string;
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--surface-2)", color: "var(--ink)",
};
const labelStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--ink-muted)", display: "block", marginBottom: 4 };

function TestSuitesInner({
  initialProjects,
  initialModules,
  canCreate,
  canDelete,
}: {
  initialProjects: QaProjectOption[];
  initialModules: QaModuleOption[];
  canCreate: boolean;
  canDelete: boolean;
}) {
  const toast = useToast();
  const [projects, setProjects] = useState(initialProjects);
  const [modules, setModules] = useState(initialModules);
  const [filterProjectId, setFilterProjectId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  const { rows, pagination, loading, page, setPage, sortBy, sortDir, onSortChange, reload } = useQaList<TestSuiteRow>(
    "/api/admin/qa/test-suites",
    { projectId: filterProjectId ? String(filterProjectId) : undefined, status: filterStatus || undefined, search: search || undefined },
    25
  );

  const [creating, setCreating] = useState(false);
  const [editingSuite, setEditingSuite] = useState<TestSuiteRow | null>(null);
  const [archiving, setArchiving] = useState<TestSuiteRow | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  async function confirmArchive() {
    if (!archiving) return;
    setArchiveLoading(true);
    try {
      const res = await fetch(`/api/admin/qa/test-suites/${archiving.Id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to archive suite.");
      toast.show({ type: "success", message: `"${archiving.Name}" archived.` });
      setArchiving(null);
      reload();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setArchiveLoading(false);
    }
  }

  const columns: QaTableColumn<TestSuiteRow>[] = [
    {
      key: "Name", label: "Name", sortable: true,
      render: (r) => (
        <Link href={`/dashboard/qa/test-suites/${r.Id}`} style={{ color: "var(--primary)" }}>
          {r.Name}
        </Link>
      ),
    },
    { key: "Project", label: "Project", render: (r) => projects.find((p) => p.Id === r.ProjectId)?.Name ?? "—" },
    { key: "Module", label: "Module", render: (r) => modules.find((m) => m.Id === r.ModuleId)?.Name ?? "—" },
    { key: "Requirement", label: "Requirement", render: (r) => r.RequirementRef ?? "—" },
    { key: "Description", label: "Description", hideByDefault: true, render: (r) => r.Description ?? "—" },
    { key: "Status", label: "Status", sortable: true, render: (r) => <Badge tone={toneFor(TEST_SUITE_STATUS_TONE, r.Status)}>{r.Status}</Badge> },
    { key: "CreatedAt", label: "Created", sortable: true, render: (r) => new Date(r.CreatedAt).toLocaleDateString() },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-3" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
          <div style={{ width: 200 }}>
            <Select
              value={filterProjectId ? String(filterProjectId) : ""}
              onChange={(v) => { setFilterProjectId(v ? Number(v) : null); setPage(1); }}
              placeholder="All projects"
              options={projects.map((p) => ({ label: p.Name, value: String(p.Id) }))}
            />
          </div>
          <div style={{ width: 160 }}>
            <Select
              value={filterStatus}
              onChange={(v) => { setFilterStatus(v); setPage(1); }}
              placeholder="All statuses"
              options={["Active", "Archived"].map((s) => ({ label: s, value: s }))}
            />
          </div>
          <input
            placeholder="Search suites..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ ...inputStyle, width: 220 }}
          />
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus size={14} /> New Test Suite
          </Button>
        )}
      </div>

      <QaTable
        storageKey="test-suites"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.Id}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={onSortChange}
        emptyMessage="No test suites yet."
        rowActions={(r) => (
          <div className="flex items-center gap-2">
            <button onClick={() => setEditingSuite(r)} title="Edit" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)" }}>
              <Pencil size={14} />
            </button>
            {canDelete && r.Status !== "Archived" && (
              <button onClick={() => setArchiving(r)} title="Archive" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}>
                <Archive size={14} />
              </button>
            )}
          </div>
        )}
      />

      {creating && (
        <CreateSuiteModal
          projects={projects}
          modules={modules}
          onProjectCreated={(p) => setProjects((prev) => [...prev, p])}
          onModuleCreated={(m) => setModules((prev) => [...prev, m])}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); reload(); }}
        />
      )}

      {editingSuite && (
        <EditSuiteModal
          suite={editingSuite}
          modules={modules.filter((m) => m.ProjectId === editingSuite.ProjectId)}
          onClose={() => setEditingSuite(null)}
          onSaved={() => { setEditingSuite(null); reload(); }}
        />
      )}

      <ConfirmDialog
        open={archiving !== null}
        onClose={() => setArchiving(null)}
        onConfirm={confirmArchive}
        title={`Archive "${archiving?.Name}"?`}
        message="Archived suites are hidden from the default list but not deleted — their test cases and execution history stay intact."
        confirmLabel="Archive Suite"
        tone="danger"
        loading={archiveLoading}
      />
    </>
  );
}

function CreateSuiteModal({
  projects, modules, onProjectCreated, onModuleCreated, onClose, onCreated,
}: {
  projects: QaProjectOption[];
  modules: QaModuleOption[];
  onProjectCreated: (p: QaProjectOption) => void;
  onModuleCreated: (m: QaModuleOption) => void;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [moduleId, setModuleId] = useState<number | null>(null);
  const [newModuleName, setNewModuleName] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [requirementRef, setRequirementRef] = useState("");
  const [saving, setSaving] = useState(false);

  const projectModules = modules.filter((m) => m.ProjectId === projectId);

  async function createModule() {
    if (!projectId || !newModuleName.trim()) return;
    try {
      const res = await fetch("/api/admin/qa/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, name: newModuleName }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to create module.");
      onModuleCreated({ Id: data.data.Id, ProjectId: projectId, Name: data.data.Name });
      setModuleId(data.data.Id);
      setNewModuleName("");
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  async function submit() {
    if (!projectId) return toast.show({ type: "error", message: "Select a project first." });
    if (!name.trim()) return toast.show({ type: "error", message: "Name is required." });
    setSaving(true);
    try {
      const res = await fetch("/api/admin/qa/test-suites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, moduleId, name, description, requirementRef }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to create test suite.");
      toast.show({ type: "success", message: `Test suite "${data.data.Name}" created.` });
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
      title="New Test Suite"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving}>{saving ? "Creating..." : "Create Suite"}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <label style={labelStyle}>Project</label>
          <ProjectSelect projects={projects} value={projectId} onChange={(id) => { setProjectId(id); setModuleId(null); }} onProjectCreated={onProjectCreated} />
        </div>
        {projectId && (
          <div>
            <label style={labelStyle}>Module (optional)</label>
            <div className="flex items-center gap-2">
              <div style={{ flex: 1 }}>
                <Select
                  value={moduleId ? String(moduleId) : ""}
                  onChange={(v) => setModuleId(v ? Number(v) : null)}
                  placeholder="No module"
                  options={projectModules.map((m) => ({ label: m.Name, value: String(m.Id) }))}
                />
              </div>
              <input placeholder="New module name" value={newModuleName} onChange={(e) => setNewModuleName(e.target.value)} style={{ ...inputStyle, width: 150 }} />
              <Button type="button" size="sm" variant="secondary" onClick={createModule}>Add</Button>
            </div>
          </div>
        )}
        <div>
          <label style={labelStyle}>Requirement received (optional)</label>
          <input
            value={requirementRef}
            onChange={(e) => setRequirementRef(e.target.value)}
            maxLength={200}
            style={inputStyle}
            placeholder="Ticket link, spec reference, or short description of the requirement this suite covers"
          />
        </div>
        <div>
          <label style={labelStyle}>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
      </div>
    </Modal>
  );
}

export function EditSuiteModal({
  suite, modules, onClose, onSaved,
}: {
  suite: TestSuiteRow;
  modules: QaModuleOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(suite.Name);
  const [description, setDescription] = useState(suite.Description ?? "");
  const [requirementRef, setRequirementRef] = useState(suite.RequirementRef ?? "");
  const [moduleId, setModuleId] = useState<number | null>(suite.ModuleId);
  const [status, setStatus] = useState(suite.Status);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/qa/test-suites/${suite.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, requirementRef, moduleId, status }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save.");
      toast.show({ type: "success", message: "Test suite updated." });
      onSaved();
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
      title={`Edit "${suite.Name}"`}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <label style={labelStyle}>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div>
          <label style={labelStyle}>Requirement received</label>
          <input value={requirementRef} onChange={(e) => setRequirementRef(e.target.value)} maxLength={200} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Module</label>
          <Select value={moduleId ? String(moduleId) : ""} onChange={(v) => setModuleId(v ? Number(v) : null)} placeholder="No module" options={modules.map((m) => ({ label: m.Name, value: String(m.Id) }))} />
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <Select value={status} onChange={setStatus} options={["Active", "Archived"].map((s) => ({ label: s, value: s }))} />
        </div>
      </div>
    </Modal>
  );
}

export function TestSuitesClient({
  projects, modules, canCreate, canDelete,
}: {
  projects: QaProjectOption[];
  modules: QaModuleOption[];
  canCreate: boolean;
  canDelete: boolean;
}) {
  return (
    <ToastProvider>
      <TestSuitesInner initialProjects={projects} initialModules={modules} canCreate={canCreate} canDelete={canDelete} />
    </ToastProvider>
  );
}
