"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface ScheduleRow {
  Id: number;
  Name: string;
  DaysOfWeek: string | null;
  StartTime: string | null;
  EndTime: string | null;
  IsBuiltIn: boolean;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.7rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

function emptyForm() {
  return { name: "", days: [] as string[], startTime: "", endTime: "" };
}

function SchedulesInner() {
  const toast = useToast();
  const [rows, setRows] = useState<ScheduleRow[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleRow | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ScheduleRow | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/web-access-control/schedules");
    const data = await res.json();
    if (res.ok && data.ok) setRows(data.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(row: ScheduleRow) {
    setEditing(row);
    setForm({
      name: row.Name,
      days: row.DaysOfWeek ? row.DaysOfWeek.split(",") : [],
      startTime: row.StartTime ?? "",
      endTime: row.EndTime ?? "",
    });
    setModalOpen(true);
  }

  function toggleDay(day: string) {
    setForm((f) => ({ ...f, days: f.days.includes(day) ? f.days.filter((d) => d !== day) : [...f.days, day] }));
  }

  async function save() {
    if (!form.name.trim()) {
      toast.show({ type: "error", message: "Schedule name is required." });
      return;
    }
    if ((form.startTime && !form.endTime) || (!form.startTime && form.endTime)) {
      toast.show({ type: "error", message: "Start time and end time must be set together." });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        daysOfWeek: form.days.length > 0 ? form.days : null,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
      };
      const res = await fetch(editing ? `/api/admin/web-access-control/schedules/${editing.Id}` : "/api/admin/web-access-control/schedules", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save schedule.");
      toast.show({ type: "success", message: editing ? "Schedule updated." : "Schedule created." });
      setModalOpen(false);
      await load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to save schedule." });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/web-access-control/schedules/${deleteTarget.Id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to delete schedule.");
      toast.show({ type: "success", message: "Schedule deleted." });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to delete schedule." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h2 style={{ fontSize: "1rem", margin: 0 }}>Schedules</h2>
          <Button size="sm" onClick={openCreate}>Add Schedule</Button>
        </div>
        {rows === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}>Name</th>
                  <th style={{ padding: "0.4rem" }}>Days</th>
                  <th style={{ padding: "0.4rem" }}>Window</th>
                  <th style={{ padding: "0.4rem" }}></th>
                  <th style={{ padding: "0.4rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>
                      {row.Name} {row.IsBuiltIn && <Badge tone="info">Built-in</Badge>}
                    </td>
                    <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{row.DaysOfWeek ?? "Every day"}</td>
                    <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{row.StartTime && row.EndTime ? `${row.StartTime} - ${row.EndTime}` : "All day"}</td>
                    <td style={{ padding: "0.4rem" }}>
                      <button onClick={() => openEdit(row)} style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "0.8rem" }}>
                        Edit
                      </button>
                    </td>
                    <td style={{ padding: "0.4rem" }}>
                      {!row.IsBuiltIn && (
                        <button onClick={() => setDeleteTarget(row)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.8rem" }}>
                          Delete
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Schedule" : "Add Schedule"}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </>
        }
      >
        <div className="field">
          <label>Name</label>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="e.g. After Hours" />
        </div>
        <div className="field">
          <label>Days (leave all unchecked for every day)</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {DAYS.map((day) => (
              <label key={day} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem" }}>
                <input type="checkbox" checked={form.days.includes(day)} onChange={() => toggleDay(day)} />
                {day}
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
          <div className="field">
            <label>Start Time</label>
            <input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} style={inputStyle} />
          </div>
          <div className="field">
            <label>End Time</label>
            <input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} style={inputStyle} />
          </div>
        </div>
        <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>
          Leave both times blank for an all-day schedule. Evaluated using this server&apos;s local time.
        </p>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Schedule"
        message={`Delete the "${deleteTarget?.Name}" schedule? Only possible when no rule currently uses it.`}
        confirmLabel="Delete"
        loading={saving}
      />
    </div>
  );
}

export function WacSchedulesClient() {
  return (
    <ToastProvider>
      <SchedulesInner />
    </ToastProvider>
  );
}
