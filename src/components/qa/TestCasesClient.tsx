"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Copy, Archive, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { QaTable, type QaTableColumn } from "@/components/qa/QaTable";
import { useQaList } from "@/components/qa/useQaList";
import { TEST_CASE_STATUS_TONE, PRIORITY_TONE, toneFor } from "@/lib/qaBadgeTones";

interface QaProjectOption { Id: number; Name: string }
interface QaSuiteOption { Id: number; ProjectId: number; Name: string }

interface TestCaseRow {
  Id: number;
  ProjectId: number;
  TestSuiteId: number;
  TestCaseNumber: string;
  Title: string;
  Priority: string;
  TestType: string;
  Status: string;
  CreatedAt: string;
}

const inputStyle: React.CSSProperties = {
  padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)",
};

const STATUSES = ["Draft", "Ready", "Approved", "Deprecated", "Archived"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];

function TestCasesInner({
  projects, suites, initialTestSuiteId, initialProjectId, canCreate, canDelete,
}: {
  projects: QaProjectOption[];
  suites: QaSuiteOption[];
  initialTestSuiteId: number | null;
  initialProjectId: number | null;
  canCreate: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [projectId, setProjectId] = useState<number | null>(initialProjectId);
  const [testSuiteId, setTestSuiteId] = useState<number | null>(initialTestSuiteId);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkArchiving, setBulkArchiving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { rows, pagination, loading, page, setPage, sortBy, sortDir, onSortChange, reload } = useQaList<TestCaseRow>(
    "/api/admin/qa/test-cases",
    {
      projectId: projectId ? String(projectId) : undefined,
      testSuiteId: testSuiteId ? String(testSuiteId) : undefined,
      status: status || undefined,
      priority: priority || undefined,
      search: search || undefined,
    },
    25
  );

  const suitesForProject = projectId ? suites.filter((s) => s.ProjectId === projectId) : suites;

  async function cloneCase(row: TestCaseRow) {
    try {
      const res = await fetch(`/api/admin/qa/test-cases/${row.Id}/clone`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to clone.");
      toast.show({ type: "success", message: `Cloned as ${data.data.TestCaseNumber}.` });
      reload();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  async function archiveCase(row: TestCaseRow) {
    try {
      const res = await fetch(`/api/admin/qa/test-cases/${row.Id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to archive.");
      toast.show({ type: "success", message: `${row.TestCaseNumber} archived.` });
      reload();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  async function confirmBulkArchive() {
    const ids = [...selectedIds];
    let ok = 0;
    for (const id of ids) {
      try {
        const res = await fetch(`/api/admin/qa/test-cases/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (res.ok && data.ok) ok++;
      } catch {
        // continue with remaining ids
      }
    }
    toast.show({ type: ok === ids.length ? "success" : "error", message: `Archived ${ok}/${ids.length} test cases.` });
    setSelectedIds(new Set());
    setBulkArchiving(false);
    reload();
  }

  function exportCsv() {
    const sp = new URLSearchParams();
    if (projectId) sp.set("projectId", String(projectId));
    if (testSuiteId) sp.set("testSuiteId", String(testSuiteId));
    if (status) sp.set("status", status);
    if (priority) sp.set("priority", priority);
    if (search) sp.set("search", search);
    window.location.href = `/api/admin/qa/test-cases/export?${sp.toString()}`;
  }

  const columns: QaTableColumn<TestCaseRow>[] = [
    {
      key: "TestCaseNumber", label: "Number", sortable: true,
      render: (r) => (
        <Link href={`/dashboard/qa/test-cases/${r.Id}`} style={{ color: "var(--primary)", fontFamily: "monospace" }}>
          {r.TestCaseNumber}
        </Link>
      ),
    },
    { key: "Title", label: "Title", sortable: true, render: (r) => r.Title },
    { key: "Priority", label: "Priority", sortable: true, render: (r) => <Badge tone={toneFor(PRIORITY_TONE, r.Priority)}>{r.Priority}</Badge> },
    { key: "TestType", label: "Type", render: (r) => r.TestType },
    { key: "Status", label: "Status", sortable: true, render: (r) => <Badge tone={toneFor(TEST_CASE_STATUS_TONE, r.Status)}>{r.Status}</Badge> },
    { key: "CreatedAt", label: "Created", sortable: true, hideByDefault: true, render: (r) => new Date(r.CreatedAt).toLocaleDateString() },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-3" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
          <div style={{ width: 180 }}>
            <Select value={projectId ? String(projectId) : ""} onChange={(v) => { setProjectId(v ? Number(v) : null); setTestSuiteId(null); setPage(1); }} placeholder="All projects" options={projects.map((p) => ({ label: p.Name, value: String(p.Id) }))} />
          </div>
          <div style={{ width: 180 }}>
            <Select value={testSuiteId ? String(testSuiteId) : ""} onChange={(v) => { setTestSuiteId(v ? Number(v) : null); setPage(1); }} placeholder="All suites" options={suitesForProject.map((s) => ({ label: s.Name, value: String(s.Id) }))} />
          </div>
          <div style={{ width: 140 }}>
            <Select value={status} onChange={(v) => { setStatus(v); setPage(1); }} placeholder="All statuses" options={STATUSES.map((s) => ({ label: s, value: s }))} />
          </div>
          <div style={{ width: 130 }}>
            <Select value={priority} onChange={(v) => { setPriority(v); setPage(1); }} placeholder="All priorities" options={PRIORITIES.map((s) => ({ label: s, value: s }))} />
          </div>
          <input placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ ...inputStyle, width: 180 }} />
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && canDelete && (
            <Button size="sm" variant="danger" onClick={() => setBulkArchiving(true)}>
              <Archive size={13} /> Archive {selectedIds.size}
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={exportCsv}>
            <Download size={13} /> Export
          </Button>
          {canCreate && (
            <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload size={13} /> Import
            </Button>
          )}
          {canCreate && (
            <Link href={`/dashboard/qa/test-cases/new${testSuiteId ? `?testSuiteId=${testSuiteId}` : ""}`}>
              <Button size="sm"><Plus size={14} /> New Test Case</Button>
            </Link>
          )}
        </div>
      </div>

      <QaTable
        storageKey="test-cases"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.Id}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={onSortChange}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        emptyMessage="No test cases match these filters."
        rowActions={(r) => (
          <div className="flex items-center gap-2">
            <button onClick={() => cloneCase(r)} title="Clone" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)" }}>
              <Copy size={14} />
            </button>
            {canDelete && r.Status !== "Archived" && (
              <button onClick={() => archiveCase(r)} title="Archive" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}>
                <Archive size={14} />
              </button>
            )}
          </div>
        )}
      />

      <ConfirmDialog
        open={bulkArchiving}
        onClose={() => setBulkArchiving(false)}
        onConfirm={confirmBulkArchive}
        title={`Archive ${selectedIds.size} test cases?`}
        message="Archived test cases are hidden from the default list but not deleted."
        confirmLabel="Archive"
        tone="danger"
      />

      {importOpen && (
        <ImportModal
          projects={projects}
          suites={suites}
          onClose={() => setImportOpen(false)}
          onImported={() => { setImportOpen(false); reload(); router.refresh(); }}
        />
      )}
    </>
  );
}

function ImportModal({
  projects, suites, onClose, onImported,
}: {
  projects: QaProjectOption[];
  suites: QaSuiteOption[];
  onClose: () => void;
  onImported: () => void;
}) {
  const toast = useToast();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [testSuiteId, setTestSuiteId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ total: number; imported: number } | null>(null);

  const suitesForProject = projectId ? suites.filter((s) => s.ProjectId === projectId) : [];

  async function submit() {
    if (!projectId || !testSuiteId || !file) {
      toast.show({ type: "error", message: "Project, suite, and a CSV file are all required." });
      return;
    }
    setImporting(true);
    try {
      const form = new FormData();
      form.set("projectId", String(projectId));
      form.set("testSuiteId", String(testSuiteId));
      form.set("file", file);
      const res = await fetch("/api/admin/qa/test-cases/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Import failed.");
      setResult({ total: data.data.total, imported: data.data.imported });
      toast.show({ type: "success", message: `Imported ${data.data.imported}/${data.data.total} rows.` });
      onImported();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(2,6,23,0.55)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="rounded-2xl border" style={{ width: 460, background: "var(--surface)", borderColor: "var(--border)", padding: "1.25rem" }}>
        <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>Import Test Cases from CSV</h2>
        <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>
          Columns: Title (required), Description, Preconditions, ExpectedResult, Priority, Severity, TestType, EstimatedMinutes.
        </p>
        <div className="flex flex-col gap-3">
          <Select value={projectId ? String(projectId) : ""} onChange={(v) => { setProjectId(v ? Number(v) : null); setTestSuiteId(null); }} placeholder="Select a project" options={projects.map((p) => ({ label: p.Name, value: String(p.Id) }))} />
          <Select value={testSuiteId ? String(testSuiteId) : ""} onChange={(v) => setTestSuiteId(v ? Number(v) : null)} placeholder="Select a test suite" options={suitesForProject.map((s) => ({ label: s.Name, value: String(s.Id) }))} />
          <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={inputStyle} />
          {result && (
            <p style={{ fontSize: "0.8rem", color: "var(--ink-secondary)" }}>Imported {result.imported} of {result.total} rows.</p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2" style={{ marginTop: "1rem" }}>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={importing}>Close</Button>
          <Button size="sm" onClick={submit} disabled={importing}>{importing ? "Importing..." : "Import"}</Button>
        </div>
      </div>
    </div>
  );
}

export function TestCasesClient(props: {
  projects: QaProjectOption[];
  suites: QaSuiteOption[];
  initialTestSuiteId: number | null;
  initialProjectId: number | null;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  return (
    <ToastProvider>
      <TestCasesInner {...props} />
    </ToastProvider>
  );
}
