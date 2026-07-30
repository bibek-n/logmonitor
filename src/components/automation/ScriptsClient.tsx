"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface ScriptRow {
  id: number;
  name: string;
  description: string | null;
  powerShellBody: string | null;
  bashBody: string | null;
  timeoutSeconds: number;
  updatedAt: string;
}

const inputStyle = {
  padding: "0.5rem 0.7rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

const textareaStyle = {
  ...inputStyle,
  width: "100%",
  minHeight: 160,
  fontFamily: "monospace",
  fontSize: "0.82rem",
  resize: "vertical" as const,
};

const emptyForm = { name: "", description: "", powerShellBody: "", bashBody: "", timeoutSeconds: 300 };

function ScriptsInner() {
  const toast = useToast();
  const [rows, setRows] = useState<ScriptRow[] | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/automation/scripts");
    const data = await res.json();
    if (res.ok && data.ok) setRows(data.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(row: ScriptRow) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      description: row.description ?? "",
      powerShellBody: row.powerShellBody ?? "",
      bashBody: row.bashBody ?? "",
      timeoutSeconds: row.timeoutSeconds,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.show({ type: "error", message: "Name is required." });
      return;
    }
    if (!form.powerShellBody.trim() && !form.bashBody.trim()) {
      toast.show({ type: "error", message: "Provide at least a PowerShell body (Windows) or a Bash body (Linux)." });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        powerShellBody: form.powerShellBody || null,
        bashBody: form.bashBody || null,
        timeoutSeconds: form.timeoutSeconds,
      };
      const res = await fetch(editingId ? `/api/admin/automation/scripts/${editingId}` : "/api/admin/automation/scripts", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save script.");
      toast.show({ type: "success", message: editingId ? "Script updated." : "Script created." });
      resetForm();
      await load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to save script." });
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(row: ScriptRow) {
    if (!confirm(`Delete script "${row.name}"? Jobs already run from it keep their own snapshot and are unaffected.`)) return;
    const res = await fetch(`/api/admin/automation/scripts/${row.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to delete script." });
      return;
    }
    toast.show({ type: "success", message: `${row.name} deleted.` });
    if (editingId === row.id) resetForm();
    await load();
  }

  return (
    <div>
      <Card style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>{editingId ? "Edit Script" : "New Script"}</h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
          <div style={{ flex: "1 1 240px" }}>
            <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Name</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ ...inputStyle, width: "100%" }} />
          </div>
          <div style={{ flex: "2 1 320px" }}>
            <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Description (optional)</label>
            <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, width: "100%" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Timeout (seconds)</label>
            <input
              type="number"
              min={5}
              max={3600}
              value={form.timeoutSeconds}
              onChange={(e) => setForm((f) => ({ ...f, timeoutSeconds: Number(e.target.value) }))}
              style={{ ...inputStyle, width: 110 }}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>PowerShell Body (runs on Windows targets)</label>
            <textarea
              value={form.powerShellBody}
              onChange={(e) => setForm((f) => ({ ...f, powerShellBody: e.target.value }))}
              style={textareaStyle}
              placeholder={"# Runs via powershell.exe -File on every Windows target\nGet-Service | Where-Object Status -ne 'Running'"}
              spellCheck={false}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Bash Body (runs on Linux targets)</label>
            <textarea
              value={form.bashBody}
              onChange={(e) => setForm((f) => ({ ...f, bashBody: e.target.value }))}
              style={textareaStyle}
              placeholder={"# Runs via bash on every Linux target\ndf -h"}
              spellCheck={false}
            />
          </div>
        </div>

        <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: "0.5rem" }}>
          A device only runs the body matching its own OS. Leave one body blank if this script only targets one platform - a job queued
          against a device with no matching body for its OS reports a clear error instead of running nothing silently.
        </p>

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
          <Button onClick={save} disabled={submitting}>
            {editingId ? "Save Changes" : "Create Script"}
          </Button>
          {editingId && (
            <Button variant="secondary" onClick={resetForm}>
              Cancel
            </Button>
          )}
        </div>
      </Card>

      <div className="dash-panel">
        {rows === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No scripts yet - create one above.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}>Name</th>
                  <th style={{ padding: "0.4rem" }}>Description</th>
                  <th style={{ padding: "0.4rem" }}>Platforms</th>
                  <th style={{ padding: "0.4rem" }}>Timeout</th>
                  <th style={{ padding: "0.4rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>{r.name}</td>
                    <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{r.description || "-"}</td>
                    <td style={{ padding: "0.4rem" }}>
                      {[r.powerShellBody ? "Windows" : null, r.bashBody ? "Linux" : null].filter(Boolean).join(" + ")}
                    </td>
                    <td style={{ padding: "0.4rem" }}>{r.timeoutSeconds}s</td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        <Button size="sm" variant="secondary" onClick={() => startEdit(r)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => remove(r)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function ScriptsClient() {
  return (
    <ToastProvider>
      <ScriptsInner />
    </ToastProvider>
  );
}
