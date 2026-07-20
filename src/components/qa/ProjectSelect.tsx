"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

export interface QaProjectOption {
  Id: number;
  Name: string;
}

// Every QA entity (Test Suite, Test Case, Test Run, Bug) is scoped to a QaProject, and this
// module ships no dedicated Projects management page (out of the spec's frontend page list) —
// so this select doubles as the only place a project can be created, via the inline "+ New
// Project" quick-add modal. High-reuse (every creation form needs it), so it's the one
// shared field component; Module/Release quick-add (needed by far fewer forms) stay inline
// in the forms that use them rather than becoming their own abstraction.
export function ProjectSelect({
  projects,
  value,
  onChange,
  onProjectCreated,
}: {
  projects: QaProjectOption[];
  value: number | null;
  onChange: (id: number | null) => void;
  onProjectCreated: (project: QaProjectOption) => void;
}) {
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function submitCreate() {
    if (!name.trim()) {
      toast.show({ type: "error", message: "Project name is required." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/qa/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to create project.");
      onProjectCreated({ Id: data.data.Id, Name: data.data.Name });
      onChange(data.data.Id);
      toast.show({ type: "success", message: `Project "${data.data.Name}" created.` });
      setCreating(false);
      setName("");
      setDescription("");
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div style={{ flex: 1 }}>
        <Select
          value={value ? String(value) : ""}
          onChange={(v) => onChange(v ? Number(v) : null)}
          placeholder="Select a project"
          options={projects.map((p) => ({ label: p.Name, value: String(p.Id) }))}
        />
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={() => setCreating(true)}>
        <Plus size={13} /> New
      </Button>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New QA Project"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitCreate} disabled={saving}>
              {saving ? "Creating..." : "Create Project"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div>
            <label style={{ fontSize: "0.8rem", color: "var(--ink-muted)", display: "block", marginBottom: 4 }}>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              style={{ width: "100%", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.8rem", color: "var(--ink-muted)", display: "block", marginBottom: 4 }}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
              style={{ width: "100%", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", resize: "vertical" }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
