"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { ProjectSelect, type QaProjectOption } from "@/components/qa/ProjectSelect";

interface EnvironmentRow {
  Id: number; ProjectId: number; Name: string; ApiUrl: string | null; DatabaseInfo: string | null;
  BuildVersion: string | null; ConfigNotes: string | null; IsActive: boolean;
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)" };
const labelStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--ink-muted)", display: "block", marginBottom: 4 };

function Inner({ projects: initialProjects, canManage }: { projects: QaProjectOption[]; canManage: boolean }) {
  const toast = useToast();
  const [projects, setProjects] = useState(initialProjects);
  const [projectId, setProjectId] = useState<number | null>(initialProjects[0]?.Id ?? null);
  const [environments, setEnvironments] = useState<EnvironmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EnvironmentRow | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/qa/environments?projectId=${projectId}`)
      .then((res) => res.json())
      .then((data) => { if (!cancelled && data.ok) setEnvironments(data.data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  function reload() {
    if (!projectId) return;
    fetch(`/api/admin/qa/environments?projectId=${projectId}`).then((res) => res.json()).then((data) => { if (data.ok) setEnvironments(data.data); });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ width: 220 }}>
          <ProjectSelect projects={projects} value={projectId} onChange={setProjectId} onProjectCreated={(p) => setProjects((prev) => [...prev, p])} />
        </div>
        {canManage && projectId && (
          <Button size="sm" onClick={() => setCreating(true)}><Plus size={14} /> New Environment</Button>
        )}
      </div>

      <Card style={{ padding: 0 }}>
        {loading ? (
          <p style={{ padding: "1rem", color: "var(--ink-muted)", fontSize: "0.85rem" }}>Loading...</p>
        ) : environments.length === 0 ? (
          <p style={{ padding: "1rem", color: "var(--ink-muted)", fontSize: "0.85rem" }}>No environments for this project yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  {["Name", "API URL", "Database", "Build", "Status", ""].map((h) => (
                    <th key={h} style={{ padding: "0.5rem 1rem", color: "var(--ink-muted)", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {environments.map((e) => (
                  <tr key={e.Id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.5rem 1rem", fontWeight: 500 }}>{e.Name}</td>
                    <td style={{ padding: "0.5rem 1rem", color: "var(--ink-secondary)" }}>{e.ApiUrl ?? "—"}</td>
                    <td style={{ padding: "0.5rem 1rem", color: "var(--ink-secondary)" }}>{e.DatabaseInfo ?? "—"}</td>
                    <td style={{ padding: "0.5rem 1rem", color: "var(--ink-secondary)" }}>{e.BuildVersion ?? "—"}</td>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      <Badge tone={e.IsActive ? "success" : "neutral"}>{e.IsActive ? "Active" : "Inactive"}</Badge>
                    </td>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      {canManage && (
                        <button onClick={() => setEditing(e)} style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "0.8rem" }}>
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
        <EnvironmentModal
          projectId={projectId}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); reload(); }}
        />
      )}
      {editing && (
        <EnvironmentModal
          projectId={editing.ProjectId}
          environment={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}

function EnvironmentModal({
  projectId, environment, onClose, onSaved,
}: {
  projectId: number;
  environment?: EnvironmentRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(environment?.Name ?? "");
  const [apiUrl, setApiUrl] = useState(environment?.ApiUrl ?? "");
  const [databaseInfo, setDatabaseInfo] = useState(environment?.DatabaseInfo ?? "");
  const [buildVersion, setBuildVersion] = useState(environment?.BuildVersion ?? "");
  const [configNotes, setConfigNotes] = useState(environment?.ConfigNotes ?? "");
  const [isActive, setIsActive] = useState(environment?.IsActive ?? true);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return toast.show({ type: "error", message: "Name is required." });
    setSaving(true);
    try {
      const url = environment ? `/api/admin/qa/environments/${environment.Id}` : "/api/admin/qa/environments";
      const res = await fetch(url, {
        method: environment ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, name, apiUrl, databaseInfo, buildVersion, configNotes, isActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save environment.");
      toast.show({ type: "success", message: environment ? "Environment updated." : "Environment created." });
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
      title={environment ? `Edit ${environment.Name}` : "New Environment"}
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
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} style={inputStyle} placeholder="DEV, QA, UAT, STAGING, PRODUCTION..." />
        </div>
        <div>
          <label style={labelStyle}>API URL</label>
          <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} style={inputStyle} placeholder="https://api-staging.example.com (no tokens/secrets)" />
        </div>
        <div>
          <label style={labelStyle}>Database</label>
          <input value={databaseInfo} onChange={(e) => setDatabaseInfo(e.target.value)} style={inputStyle} placeholder="Descriptive only, e.g. 'staging replica'" />
        </div>
        <div>
          <label style={labelStyle}>Build Version</label>
          <input value={buildVersion} onChange={(e) => setBuildVersion(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Config Notes</label>
          <textarea value={configNotes} onChange={(e) => setConfigNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        {environment && (
          <label className="flex items-center gap-2" style={{ fontSize: "0.85rem", cursor: "pointer" }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
        )}
      </div>
    </Modal>
  );
}

export function EnvironmentsClient(props: { projects: QaProjectOption[]; canManage: boolean }) {
  return (
    <ToastProvider>
      <Inner {...props} />
    </ToastProvider>
  );
}
