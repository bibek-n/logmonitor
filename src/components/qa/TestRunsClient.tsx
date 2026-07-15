"use client";

import { useState, useEffect } from "react";
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
interface QaRunTypeOption { Id: number; Name: string; Description: string | null }
interface QaEnvironmentOption { Id: number; ProjectId: number; Name: string }
interface QaBuildOption { Id: number; ProjectId: number; BuildNumber: string }

interface TestRunRow {
  Id: number;
  TestRunNumber: string;
  Name: string;
  ProjectId: number;
  ReleaseId: number | null;
  Status: string;
  RunTypeId: number | null;
  RunTypeName: string | null;
  StartDate: string | null;
  EndDate: string | null;
  QaApprovedAt: string | null;
  CreatedAt: string;
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)" };
const labelStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--ink-muted)", display: "block", marginBottom: 4 };
const STATUSES = ["Planned", "In Progress", "Paused", "Completed", "Cancelled"];

function TestRunsInner({
  projects: initialProjects, releases: initialReleases, runTypes, environments, builds, canManage,
}: {
  projects: QaProjectOption[]; releases: QaReleaseOption[]; runTypes: QaRunTypeOption[];
  environments: QaEnvironmentOption[]; builds: QaBuildOption[]; canManage: boolean;
}) {
  const toast = useToast();
  const [projects, setProjects] = useState(initialProjects);
  const [releases, setReleases] = useState(initialReleases);
  const [filterProjectId, setFilterProjectId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const { rows, pagination, loading, page, setPage, sortBy, sortDir, onSortChange, reload } = useQaList<TestRunRow>(
    "/api/admin/qa/test-runs",
    { projectId: filterProjectId ? String(filterProjectId) : undefined, status: filterStatus || undefined, search: search || undefined },
    25
  );

  const columns: QaTableColumn<TestRunRow>[] = [
    {
      key: "TestRunNumber", label: "Run", sortable: true,
      render: (r) => <Link href={`/dashboard/qa/test-runs/${r.Id}`} style={{ color: "var(--primary)", fontFamily: "monospace" }}>{r.TestRunNumber}</Link>,
    },
    { key: "Name", label: "Name", sortable: true, render: (r) => r.Name },
    { key: "Project", label: "Project", render: (r) => projects.find((p) => p.Id === r.ProjectId)?.Name ?? "—" },
    { key: "Release", label: "Release", render: (r) => releases.find((rel) => rel.Id === r.ReleaseId)?.Name ?? "—" },
    { key: "RunType", label: "Type", render: (r) => r.RunTypeName ?? "—" },
    { key: "Status", label: "Status", sortable: true, render: (r) => <Badge tone={toneFor(TEST_RUN_STATUS_TONE, r.Status)}>{r.Status}</Badge> },
    { key: "QaApprovedAt", label: "QA Approved", render: (r) => r.QaApprovedAt ? <Badge tone="success">Approved</Badge> : <span style={{ color: "var(--ink-muted)" }}>—</span> },
    { key: "StartDate", label: "Start", hideByDefault: true, render: (r) => r.StartDate ?? "—" },
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
          <input placeholder="Search runs..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ ...inputStyle, width: 200 }} />
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreating(true)}><Plus size={14} /> New Test Run</Button>
        )}
      </div>

      <QaTable
        storageKey="test-runs"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.Id}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={onSortChange}
        emptyMessage="No test runs yet."
      />

      {creating && (
        <CreateRunModal
          projects={projects}
          releases={releases}
          runTypes={runTypes}
          environments={environments}
          builds={builds}
          onProjectCreated={(p) => setProjects((prev) => [...prev, p])}
          onReleaseCreated={(r) => setReleases((prev) => [...prev, r])}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); reload(); }}
        />
      )}
    </>
  );
}

interface MatchingCase { Id: number; TestCaseNumber: string; Title: string }

function CreateRunModal({
  projects, releases, runTypes, environments, builds, onProjectCreated, onReleaseCreated, onClose, onCreated,
}: {
  projects: QaProjectOption[];
  releases: QaReleaseOption[];
  runTypes: QaRunTypeOption[];
  environments: QaEnvironmentOption[];
  builds: QaBuildOption[];
  onProjectCreated: (p: QaProjectOption) => void;
  onReleaseCreated: (r: QaReleaseOption) => void;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [releaseId, setReleaseId] = useState<number | null>(null);
  const [newReleaseName, setNewReleaseName] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [runTypeId, setRunTypeId] = useState<number | null>(null);
  const [environmentId, setEnvironmentId] = useState<number | null>(null);
  const [buildId, setBuildId] = useState<number | null>(null);
  const [environment, setEnvironment] = useState("");
  const [browser, setBrowser] = useState("");
  const [operatingSystem, setOperatingSystem] = useState("");
  const [device, setDevice] = useState("");
  const [saving, setSaving] = useState(false);

  const environmentsForProject = environments.filter((e) => e.ProjectId === projectId);
  const buildsForProject = builds.filter((b) => b.ProjectId === projectId);

  // "Select a run type → the system lists matching test cases (Auto-Load Test Cases)". A test
  // case can belong to several run types, so the picker always shows the union for this
  // project/type and lets the user narrow it down to a subset (or select none for a manual run).
  const [autoLoad, setAutoLoad] = useState(true);
  const [matchingCases, setMatchingCases] = useState<MatchingCase[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<number>>(new Set());

  const releasesForProject = releases.filter((r) => r.ProjectId === projectId);

  useEffect(() => {
    if (!projectId || !runTypeId || !autoLoad) {
      setMatchingCases([]);
      setSelectedCaseIds(new Set());
      return;
    }
    let cancelled = false;
    setLoadingCases(true);
    fetch(`/api/admin/qa/test-cases?projectId=${projectId}&runTypeId=${runTypeId}&pageSize=200`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.ok) return;
        const cases: MatchingCase[] = data.data.map((c: { Id: number; TestCaseNumber: string; Title: string }) => ({ Id: c.Id, TestCaseNumber: c.TestCaseNumber, Title: c.Title }));
        setMatchingCases(cases);
        setSelectedCaseIds(new Set(cases.map((c) => c.Id)));
      })
      .finally(() => { if (!cancelled) setLoadingCases(false); });
    return () => { cancelled = true; };
  }, [projectId, runTypeId, autoLoad]);

  async function createRelease() {
    if (!projectId || !newReleaseName.trim()) return;
    try {
      const res = await fetch("/api/admin/qa/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, name: newReleaseName }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to create release.");
      onReleaseCreated({ Id: data.data.Id, ProjectId: projectId, Name: data.data.Name });
      setReleaseId(data.data.Id);
      setNewReleaseName("");
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  async function submit() {
    if (!projectId) return toast.show({ type: "error", message: "Select a project first." });
    if (!name.trim()) return toast.show({ type: "error", message: "Name is required." });
    setSaving(true);
    try {
      const res = await fetch("/api/admin/qa/test-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId, releaseId, name, description, runTypeId, environmentId, buildId,
          environment, browser, operatingSystem, device,
          testCaseIds: [...selectedCaseIds],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to create test run.");
      toast.show({ type: "success", message: `Test run ${data.data.TestRunNumber} created.` });
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
      title="New Test Run"
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving}>{saving ? "Creating..." : "Create Test Run"}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <label style={labelStyle}>Project</label>
          <ProjectSelect projects={projects} value={projectId} onChange={(id) => { setProjectId(id); setReleaseId(null); }} onProjectCreated={onProjectCreated} />
        </div>
        {projectId && (
          <div>
            <label style={labelStyle}>Release (optional)</label>
            <div className="flex items-center gap-2">
              <div style={{ flex: 1 }}>
                <Select value={releaseId ? String(releaseId) : ""} onChange={(v) => setReleaseId(v ? Number(v) : null)} placeholder="No release" options={releasesForProject.map((r) => ({ label: r.Name, value: String(r.Id) }))} />
              </div>
              <input placeholder="New release name" value={newReleaseName} onChange={(e) => setNewReleaseName(e.target.value)} style={{ ...inputStyle, width: 150 }} />
              <Button type="button" size="sm" variant="secondary" onClick={createRelease}>Add</Button>
            </div>
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
        <div>
          <label style={labelStyle}>Run Type</label>
          <Select
            value={runTypeId ? String(runTypeId) : ""}
            onChange={(v) => setRunTypeId(v ? Number(v) : null)}
            placeholder="Select a run type"
            options={runTypes.map((t) => ({ label: t.Name, value: String(t.Id) }))}
          />
        </div>
        {projectId && (environmentsForProject.length > 0 || buildsForProject.length > 0) && (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            {environmentsForProject.length > 0 && (
              <div>
                <label style={labelStyle}>Environment (managed)</label>
                <Select
                  value={environmentId ? String(environmentId) : ""}
                  onChange={(v) => setEnvironmentId(v ? Number(v) : null)}
                  placeholder="None"
                  options={environmentsForProject.map((e) => ({ label: e.Name, value: String(e.Id) }))}
                />
              </div>
            )}
            {buildsForProject.length > 0 && (
              <div>
                <label style={labelStyle}>Build (managed)</label>
                <Select
                  value={buildId ? String(buildId) : ""}
                  onChange={(v) => setBuildId(v ? Number(v) : null)}
                  placeholder="None"
                  options={buildsForProject.map((b) => ({ label: b.BuildNumber, value: String(b.Id) }))}
                />
              </div>
            )}
          </div>
        )}
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <div>
            <label style={labelStyle}>Environment (free text)</label>
            <input value={environment} onChange={(e) => setEnvironment(e.target.value)} style={inputStyle} placeholder="Staging, Production..." />
          </div>
          <div>
            <label style={labelStyle}>Browser</label>
            <input value={browser} onChange={(e) => setBrowser(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>OS</label>
            <input value={operatingSystem} onChange={(e) => setOperatingSystem(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Device</label>
            <input value={device} onChange={(e) => setDevice(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {projectId && runTypeId && (
          <div>
            <label className="flex items-center gap-2" style={{ ...labelStyle, cursor: "pointer" }}>
              <input type="checkbox" checked={autoLoad} onChange={(e) => setAutoLoad(e.target.checked)} />
              Auto-load matching test cases
            </label>
            {autoLoad && (
              loadingCases ? (
                <p style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>Loading matching test cases...</p>
              ) : matchingCases.length === 0 ? (
                <p style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>No test cases are assigned to this run type yet.</p>
              ) : (
                <div>
                  <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>{selectedCaseIds.size} of {matchingCases.length} selected</span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setSelectedCaseIds(new Set(matchingCases.map((c) => c.Id)))} style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "0.76rem" }}>Select all</button>
                      <button type="button" onClick={() => setSelectedCaseIds(new Set())} style={{ background: "none", border: "none", color: "var(--ink-muted)", cursor: "pointer", fontSize: "0.76rem" }}>Clear</button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5" style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem" }}>
                    {matchingCases.map((c) => (
                      <label key={c.Id} className="flex items-center gap-2" style={{ fontSize: "0.83rem", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={selectedCaseIds.has(c.Id)}
                          onChange={() => setSelectedCaseIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(c.Id)) next.delete(c.Id); else next.add(c.Id);
                            return next;
                          })}
                        />
                        <span style={{ fontFamily: "monospace", color: "var(--ink-muted)" }}>{c.TestCaseNumber}</span> {c.Title}
                      </label>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function TestRunsClient(props: {
  projects: QaProjectOption[]; releases: QaReleaseOption[]; runTypes: QaRunTypeOption[];
  environments: QaEnvironmentOption[]; builds: QaBuildOption[]; canManage: boolean;
}) {
  return (
    <ToastProvider>
      <TestRunsInner {...props} />
    </ToastProvider>
  );
}
