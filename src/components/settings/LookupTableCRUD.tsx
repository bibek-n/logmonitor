"use client";

import { useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

export interface LookupField {
  key: string; // camelCase, matches the API body key
  label: string;
  type: "text" | "textarea" | "select";
  options?: { label: string; value: string }[];
  required?: boolean;
}

export interface LookupColumn {
  key: string; // PascalCase, matches the row's field name
  label: string;
  render?: (row: Record<string, unknown>) => ReactNode;
}

interface LookupTableCRUDProps {
  title: string;
  apiBase: string; // e.g. /api/admin/settings/organization/departments
  rows: Record<string, unknown>[];
  fields: LookupField[];
  columns: LookupColumn[];
}

function capitalize(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function emptyForm(fields: LookupField[]): Record<string, string> {
  const form: Record<string, string> = {};
  fields.forEach((f) => {
    form[f.key] = "";
  });
  return form;
}

export function LookupTableCRUD({ title, apiBase, rows, fields, columns }: LookupTableCRUDProps) {
  const router = useRouter();
  const toast = useToast();
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm(fields));
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  function startCreate() {
    setForm(emptyForm(fields));
    setEditingId("new");
  }

  function startEdit(row: Record<string, unknown>) {
    const next: Record<string, string> = {};
    fields.forEach((f) => {
      const raw = row[capitalize(f.key)];
      next[f.key] = raw === null || raw === undefined ? "" : String(raw);
    });
    setForm(next);
    setEditingId(Number(row.Id));
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm(fields));
  }

  async function save() {
    const missingRequired = fields.find((f) => f.required && !form[f.key]?.trim());
    if (missingRequired) {
      toast.show({ type: "error", message: `${missingRequired.label} is required.` });
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, string | number> = {};
      fields.forEach((f) => {
        if (f.type === "select" && form[f.key]) {
          body[f.key] = Number(form[f.key]);
        } else {
          body[f.key] = form[f.key];
        }
      });

      const url = editingId === "new" ? apiBase : `${apiBase}/${editingId}`;
      const method = editingId === "new" ? "POST" : "PATCH";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Save failed");

      toast.show({ type: "success", message: `${title} saved.` });
      cancelEdit();
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${apiBase}/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Delete failed");
      toast.show({ type: "success", message: `${deleteTarget.label} deleted.` });
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Delete failed." });
    } finally {
      setDeleting(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.5rem 0.6rem",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--ink)",
    fontSize: "0.83rem",
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 style={{ fontSize: "0.95rem", margin: 0, color: "var(--ink)" }}>{title}</h3>
        {editingId === null && (
          <Button size="sm" onClick={startCreate}>
            <Plus size={14} /> Add
          </Button>
        )}
      </div>

      {editingId !== null && (
        <div className="flex flex-col gap-2 rounded-xl p-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          {fields.map((f) => (
            <div key={f.key}>
              <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)", display: "block", marginBottom: "0.25rem" }}>
                {f.label}
                {f.required && " *"}
              </label>
              {f.type === "select" ? (
                <Select
                  value={form[f.key] ?? ""}
                  onChange={(v) => setForm((p) => ({ ...p, [f.key]: v }))}
                  options={f.options ?? []}
                  placeholder={`Select ${f.label.toLowerCase()}`}
                />
              ) : f.type === "textarea" ? (
                <textarea
                  style={{ ...fieldStyle, resize: "vertical" }}
                  rows={2}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                />
              ) : (
                <input
                  style={fieldStyle}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button size="sm" variant="secondary" onClick={cancelEdit} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              {columns.map((c) => (
                <th key={c.key} style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>
                  {c.label}
                </th>
              ))}
              <th style={{ width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.Id)} style={{ borderBottom: "1px solid var(--border)" }}>
                {columns.map((c) => (
                  <td key={c.key} style={{ padding: "0.4rem 0.6rem" }}>
                    {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                  </td>
                ))}
                <td style={{ padding: "0.4rem 0.6rem", textAlign: "right" }}>
                  <button onClick={() => startEdit(row)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)", marginRight: 8 }}>
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ id: Number(row.Id), label: String(row[columns[0].key] ?? "this item") })}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} style={{ padding: "1rem", textAlign: "center", color: "var(--ink-muted)" }}>
                  None yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Delete ${deleteTarget?.label ?? ""}?`}
        message="This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        loading={deleting}
      />
    </Card>
  );
}
