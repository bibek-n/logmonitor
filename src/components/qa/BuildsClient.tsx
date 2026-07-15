"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { ProjectSelect, type QaProjectOption } from "@/components/qa/ProjectSelect";

interface BuildRow {
  Id: number; ProjectId: number; ReleaseId: number | null; BuildNumber: string; GitCommit: string | null;
  Branch: string | null; DeploymentDate: string | null; EnvironmentId: number | null; Status: string;
}
interface EnvironmentOption { Id: number; ProjectId: number; Name: string }
interface ReleaseOption { Id: number; ProjectId: number; Name: string }

const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)" };
const labelStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--ink-muted)", display: "block", marginBottom: 4 };
const BUILD_STATUSES = ["Pending", "Deployed", "Failed", "Rolled Back"];
const STATUS_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  Deployed: "success", Failed: "danger", "Rolled Back": "warning", Pending: "neutral",
};

function Inner({
  projects: initialProjects, environments, releases, canManage,
}: { projects: QaProjectOption[]; environments: EnvironmentOption[]; releases: ReleaseOption[]; canManage: boolean }) {
  const toast = useToast();
  const [projects, setProjects] = useState(initialProjects);
  const [projectId, setProjectId] = useState<number | null>(initialProjects[0]?.Id ?? null);
  const [builds, setBuilds] = useState<BuildRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BuildRow | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/qa/builds?projectId=${projectId}`)
      .then((res) => res.json())
      .then((data) => { if (!cancelled && data.ok) setBuilds(data.data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  function reload() {
    if (!projectId) return;
    fetch(`/api/admin/qa/builds?projectId=${projectId}`).then((res) => res.json()).then((data) => { if (data.ok) setBuilds(data.data); });
  }

  const environmentsForProject = environments.filter((e) => e.ProjectId === projectId);
  const releasesForProject = releases.filter((r) => r.ProjectId === projectId);

  return (
    <div>
      <div className="flex items-center justify-between mb-3" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ width: 220 }}>
          <ProjectSelect projects={projects} value={projectId} onChange={setProjectId} onProjectCreated={(p) => setProjects((prev) => [...prev, p])} />
        </div>
        {canManage && projectId && (
          <Button size="sm" onClick={() => setCreating(true)}><Plus size={14} /> New Build</Button>
        )}
      </div>

      <Card style={{ padding: 0 }}>
        {loading ? (
          <p style={{ padding: "1rem", color: "var(--ink-muted)", fontSize: "0.85rem" }}>Loading...</p>
        ) : builds.length === 0 ? (
          <p style={{ padding: "1rem", color: "var(--ink-muted)", fontSize: "0.85rem" }}>No builds tracked for this project yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  {["Build", "Commit", "Branch", "Environment", "Deployed", "Status", ""].map((h) => (
                    <th key={h} style={{ padding: "0.5rem 1rem", color: "var(--ink-muted)", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {builds.map((b) => (
                  <tr key={b.Id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.5rem 1rem", fontFamily: "monospace" }}>{b.BuildNumber}</td>
                    <td style={{ padding: "0.5rem 1rem", fontFamily: "monospace", color: "var(--ink-muted)" }}>{b.GitCommit ?? "—"}</td>
                    <td style={{ padding: "0.5rem 1rem", color: "var(--ink-secondary)" }}>{b.Branch ?? "—"}</td>
                    <td style={{ padding: "0.5rem 1rem", color: "var(--ink-secondary)" }}>{environments.find((e) => e.Id === b.EnvironmentId)?.Name ?? "—"}</td>
                    <td style={{ padding: "0.5rem 1rem", whiteSpace: "nowrap" }}>{b.DeploymentDate ? new Date(b.DeploymentDate).toLocaleString() : "—"}</td>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      <Badge tone={STATUS_TONE[b.Status] ?? "neutral"}>{b.Status}</Badge>
                    </td>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      {canManage && (
                        <button onClick={() => setEditing(b)} style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "0.8rem" }}>
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {creating && projectId && (
        <BuildModal
          projectId={projectId}
          environments={environmentsForProject}
          releases={releasesForProject}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); reload(); }}
        />
      )}
      {editing && (
        <BuildModal
          projectId={editing.ProjectId}
          build={editing}
          environments={environmentsForProject}
          releases={releasesForProject}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}

function BuildModal({
  projectId, build, environments, releases, onClose, onSaved,
}: {
  projectId: number;
  build?: BuildRow;
  environments: EnvironmentOption[];
  releases: ReleaseOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [buildNumber, setBuildNumber] = useState(build?.BuildNumber ?? "");
  const [gitCommit, setGitCommit] = useState(build?.GitCommit ?? "");
  const [branch, setBranch] = useState(build?.Branch ?? "");
  const [environmentId, setEnvironmentId] = useState<number | null>(build?.EnvironmentId ?? null);
  const [releaseId, setReleaseId] = useState<number | null>(build?.ReleaseId ?? null);
  const [status, setStatus] = useState(build?.Status ?? "Pending");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!buildNumber.trim()) return toast.show({ type: "error", message: "Build number is required." });
    setSaving(true);
    try {
      const res = build
        ? await fetch(`/api/admin/qa/builds/${build.Id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status, environmentId, gitCommit, branch }),
          })
        : await fetch("/api/admin/qa/builds", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId, releaseId, buildNumber, gitCommit, branch, environmentId, status }),
          });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save build.");
      toast.show({ type: "success", message: build ? "Build updated." : "Build created." });
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
      title={build ? `Edit ${build.BuildNumber}` : "New Build"}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {!build && (
          <div>
            <label style={labelStyle}>Build Number</label>
            <input value={buildNumber} onChange={(e) => setBuildNumber(e.target.value)} maxLength={100} style={inputStyle} placeholder="v1.4.2, #482, commit sha..." />
          </div>
        )}
        {!build && releases.length > 0 && (
          <div>
            <label style={labelStyle}>Release (optional)</label>
            <Select value={releaseId ? String(releaseId) : ""} onChange={(v) => setReleaseId(v ? Number(v) : null)} placeholder="No release" options={releases.map((r) => ({ label: r.Name, value: String(r.Id) }))} />
          </div>
        )}
        <div>
          <label style={labelStyle}>Git Commit</label>
          <input value={gitCommit} onChange={(e) => setGitCommit(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Branch</label>
          <input value={branch} onChange={(e) => setBranch(e.target.value)} style={inputStyle} />
        </div>
        {environments.length > 0 && (
          <div>
            <label style={labelStyle}>Environment</label>
            <Select value={environmentId ? String(environmentId) : ""} onChange={(v) => setEnvironmentId(v ? Number(v) : null)} placeholder="None" options={environments.map((e) => ({ label: e.Name, value: String(e.Id) }))} />
          </div>
        )}
        <div>
          <label style={labelStyle}>Status</label>
          <Select value={status} onChange={setStatus} options={BUILD_STATUSES.map((s) => ({ label: s, value: s }))} />
        </div>
      </div>
    </Modal>
  );
}

export function BuildsClient(props: { projects: QaProjectOption[]; environments: EnvironmentOption[]; releases: ReleaseOption[]; canManage: boolean }) {
  return (
    <ToastProvider>
      <Inner {...props} />
    </ToastProvider>
  );
}
