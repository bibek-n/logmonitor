"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { DeviceMultiSelect } from "./DeviceMultiSelect";

interface ScriptOption {
  id: number;
  name: string;
}

interface DeviceOption {
  deviceId: string;
  deviceName: string | null;
  hostname: string;
  deviceType: string;
  os: string;
}

interface ScheduleRow {
  id: number;
  scriptId: number;
  scriptName?: string;
  name: string;
  intervalMinutes: number;
  nextRunAt: string;
  lastRunAt: string | null;
  isActive: boolean;
  targetDeviceIds: string[];
}

const inputStyle = {
  padding: "0.5rem 0.7rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

const emptyForm = { name: "", scriptId: null as number | null, intervalMinutes: 60, deviceIds: [] as string[] };

function SchedulesInner() {
  const toast = useToast();
  const [scripts, setScripts] = useState<ScriptOption[] | null>(null);
  const [devices, setDevices] = useState<DeviceOption[] | null>(null);
  const [rows, setRows] = useState<ScheduleRow[] | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/automation/schedules");
    const data = await res.json();
    if (res.ok && data.ok) setRows(data.data);
  }, []);

  useEffect(() => {
    (async () => {
      const [scriptsRes, devicesRes] = await Promise.all([fetch("/api/admin/automation/scripts"), fetch("/api/admin/automation/devices")]);
      const scriptsData = await scriptsRes.json();
      const devicesData = await devicesRes.json();
      if (scriptsRes.ok && scriptsData.ok) setScripts(scriptsData.data);
      if (devicesRes.ok && devicesData.ok) setDevices(devicesData.data);
    })();
    load();
  }, [load]);

  function startEdit(row: ScheduleRow) {
    setEditingId(row.id);
    setForm({ name: row.name, scriptId: row.scriptId, intervalMinutes: row.intervalMinutes, deviceIds: row.targetDeviceIds });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function save() {
    if (!form.name.trim() || !form.scriptId || form.deviceIds.length === 0) {
      toast.show({ type: "error", message: "Name, script, and at least one target device are required." });
      return;
    }
    setSubmitting(true);
    try {
      const payload = editingId
        ? { name: form.name, intervalMinutes: form.intervalMinutes, deviceIds: form.deviceIds }
        : { name: form.name, scriptId: form.scriptId, intervalMinutes: form.intervalMinutes, deviceIds: form.deviceIds, isActive: true };
      const res = await fetch(editingId ? `/api/admin/automation/schedules/${editingId}` : "/api/admin/automation/schedules", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save schedule.");
      toast.show({ type: "success", message: editingId ? "Schedule updated." : "Schedule created." });
      resetForm();
      await load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to save schedule." });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(row: ScheduleRow) {
    const res = await fetch(`/api/admin/automation/schedules/${row.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !row.isActive }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to update schedule." });
      return;
    }
    await load();
  }

  async function remove(row: ScheduleRow) {
    if (!confirm(`Delete schedule "${row.name}"?`)) return;
    const res = await fetch(`/api/admin/automation/schedules/${row.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to delete schedule." });
      return;
    }
    toast.show({ type: "success", message: `${row.name} deleted.` });
    if (editingId === row.id) resetForm();
    await load();
  }

  return (
    <div>
      <Card style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>{editingId ? "Edit Schedule" : "New Schedule"}</h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
          <div style={{ flex: "1 1 220px" }}>
            <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Name</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ ...inputStyle, width: "100%" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Script</label>
            <select
              value={form.scriptId ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, scriptId: e.target.value ? Number(e.target.value) : null }))}
              disabled={!!editingId}
              style={{ ...inputStyle, minWidth: 220 }}
            >
              <option value="">Choose a script...</option>
              {scripts?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Every (minutes)</label>
            <input
              type="number"
              min={1}
              max={43200}
              value={form.intervalMinutes}
              onChange={(e) => setForm((f) => ({ ...f, intervalMinutes: Number(e.target.value) }))}
              style={{ ...inputStyle, width: 110 }}
            />
          </div>
        </div>

        <div style={{ marginBottom: "0.8rem" }}>
          <DeviceMultiSelect devices={devices ?? []} selected={form.deviceIds} onChange={(ids) => setForm((f) => ({ ...f, deviceIds: ids }))} />
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Button onClick={save} disabled={submitting}>
            {editingId ? "Save Changes" : "Create Schedule"}
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
          <p style={{ color: "var(--ink-muted)" }}>No scheduled jobs yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}>Name</th>
                  <th style={{ padding: "0.4rem" }}>Script</th>
                  <th style={{ padding: "0.4rem" }}>Every</th>
                  <th style={{ padding: "0.4rem" }}>Targets</th>
                  <th style={{ padding: "0.4rem" }}>Next Run</th>
                  <th style={{ padding: "0.4rem" }}>Active</th>
                  <th style={{ padding: "0.4rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>{r.name}</td>
                    <td style={{ padding: "0.4rem" }}>{r.scriptName}</td>
                    <td style={{ padding: "0.4rem" }}>{r.intervalMinutes}m</td>
                    <td style={{ padding: "0.4rem" }}>{r.targetDeviceIds.length}</td>
                    <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{new Date(r.nextRunAt).toLocaleString()}</td>
                    <td style={{ padding: "0.4rem" }}>{r.isActive ? "Yes" : "No"}</td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        <Button size="sm" variant="secondary" onClick={() => startEdit(r)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => toggleActive(r)}>
                          {r.isActive ? "Pause" : "Resume"}
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

export function SchedulesClient() {
  return (
    <ToastProvider>
      <SchedulesInner />
    </ToastProvider>
  );
}
