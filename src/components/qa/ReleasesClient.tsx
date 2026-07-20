"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { ProjectSelect, type QaProjectOption } from "@/components/qa/ProjectSelect";
import type { BadgeTone } from "@/lib/qaBadgeTones";

interface ReleaseRow {
  Id: number;
  ProjectId: number;
  Name: string;
  ReleaseDate: string | null;
  Status: string;
  ReleasedByUserId: number | null;
  ReleasedAt: string | null;
  CreatedAt: string;
}

const RELEASE_STATUS_TONE: Record<string, BadgeTone> = {
  Planned: "neutral",
  "In Progress": "info",
  Released: "success",
  Cancelled: "danger",
};

const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)" };
const labelStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--ink-muted)", display: "block", marginBottom: 4 };

function Inner({ projects: initialProjects, releases, canManage }: { projects: QaProjectOption[]; releases: ReleaseRow[]; canManage: boolean }) {
  const [projects, setProjects] = useState(initialProjects);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="flex items-center justify-end mb-3">
        {canManage && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus size={14} /> New Release
          </Button>
        )}
      </div>

      {releases.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No releases yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {releases.map((r) => (
            <Link
              key={r.Id}
              href={`/dashboard/qa/releases/${r.Id}`}
              className="flex items-center justify-between"
              style={{ padding: "0.75rem 1rem", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", textDecoration: "none" }}
            >
              <div>
                <div style={{ fontSize: "0.9rem", color: "var(--ink)", fontWeight: 500 }}>{r.Name}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
                  {projects.find((p) => p.Id === r.ProjectId)?.Name ?? "—"}
                  {r.ReleaseDate ? ` · ${r.ReleaseDate}` : ""}
                </div>
              </div>
              <Badge tone={RELEASE_STATUS_TONE[r.Status] ?? "neutral"}>{r.Status}</Badge>
            </Link>
          ))}
        </div>
      )}

      {creating && (
        <CreateReleaseModal
          projects={projects}
          onProjectCreated={(p) => setProjects((prev) => [...prev, p])}
          onClose={() => setCreating(false)}
        />
      )}
    </>
  );
}

function CreateReleaseModal({
  projects, onProjectCreated, onClose,
}: {
  projects: QaProjectOption[];
  onProjectCreated: (p: QaProjectOption) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!projectId) return toast.show({ type: "error", message: "Select a project first." });
    if (!name.trim()) return toast.show({ type: "error", message: "Release name is required." });
    setSaving(true);
    try {
      const res = await fetch("/api/admin/qa/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, name, releaseDate: releaseDate || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to create release.");
      toast.show({ type: "success", message: `Release "${data.data.Name}" created.` });
      window.location.href = `/dashboard/qa/releases/${data.data.Id}`;
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
      title="New Release"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving}>{saving ? "Creating..." : "Create Release"}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <label style={labelStyle}>Project</label>
          <ProjectSelect projects={projects} value={projectId} onChange={setProjectId} onProjectCreated={onProjectCreated} />
        </div>
        <div>
          <label style={labelStyle}>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} style={inputStyle} placeholder="v1.4.0" />
        </div>
        <div>
          <label style={labelStyle}>Target release date (optional)</label>
          <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} style={inputStyle} />
        </div>
      </div>
    </Modal>
  );
}

export function ReleasesClient(props: { projects: QaProjectOption[]; releases: ReleaseRow[]; canManage: boolean }) {
  return (
    <ToastProvider>
      <Inner {...props} />
    </ToastProvider>
  );
}
