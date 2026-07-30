"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface MonitorOption {
  id: number;
  name: string;
  kind: "Website" | "API";
}

interface WindowRow {
  Id: number;
  Name: string;
  Description: string | null;
  StartsAt: string;
  EndsAt: string;
  IsRecurring: boolean;
  RecurrenceRule: "Daily" | "Weekly" | "Monthly" | null;
  IsActive: boolean;
  monitorIds: number[];
}

interface FormValues {
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  isRecurring: boolean;
  recurrenceRule: "Daily" | "Weekly" | "Monthly";
  isActive: boolean;
  monitorIds: number[];
}

const DEFAULT_FORM: FormValues = { name: "", description: "", startsAt: "", endsAt: "", isRecurring: false, recurrenceRule: "Weekly", isActive: true, monitorIds: [] };

const inputStyle = {
  padding: "0.5rem 0.7rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toFormValues(w: WindowRow): FormValues {
  return {
    name: w.Name,
    description: w.Description ?? "",
    startsAt: toLocalInputValue(w.StartsAt),
    endsAt: toLocalInputValue(w.EndsAt),
    isRecurring: w.IsRecurring,
    recurrenceRule: w.RecurrenceRule ?? "Weekly",
    isActive: w.IsActive,
    monitorIds: w.monitorIds,
  };
}

function toPayload(v: FormValues) {
  return {
    name: v.name,
    description: v.description || null,
    startsAt: v.startsAt,
    endsAt: v.endsAt,
    isRecurring: v.isRecurring,
    recurrenceRule: v.isRecurring ? v.recurrenceRule : null,
    isActive: v.isActive,
    monitorIds: v.monitorIds,
  };
}

function WindowForm({ id, initial, monitors, onSaved, onCancel }: { id: number | "new"; initial: FormValues; monitors: MonitorOption[]; onSaved: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [values, setValues] = useState<FormValues>(initial);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof FormValues>(key: K, val: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  function toggleMonitor(monitorId: number) {
    set("monitorIds", values.monitorIds.includes(monitorId) ? values.monitorIds.filter((x) => x !== monitorId) : [...values.monitorIds, monitorId]);
  }

  async function save() {
    if (!values.name.trim() || !values.startsAt || !values.endsAt || values.monitorIds.length === 0) {
      toast.show({ type: "error", message: "Name, start/end time, and at least one monitor are required." });
      return;
    }
    setSubmitting(true);
    try {
      const isNew = id === "new";
      const res = await fetch(isNew ? "/api/admin/monitoring/maintenance" : `/api/admin/monitoring/maintenance/${id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(values)),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save maintenance window.");
      toast.show({ type: "success", message: "Maintenance window saved." });
      onSaved();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to save maintenance window." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card style={{ marginBottom: "1rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Name</label>
          <input value={values.name} onChange={(e) => set("name", e.target.value)} style={{ ...inputStyle, width: "100%" }} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", marginTop: "1.3rem" }}>
          <input type="checkbox" checked={values.isActive} onChange={(e) => set("isActive", e.target.checked)} />
          Active
        </label>
      </div>

      <div style={{ marginBottom: "0.75rem" }}>
        <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Description</label>
        <input value={values.description} onChange={(e) => set("description", e.target.value)} style={{ ...inputStyle, width: "100%" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Starts At</label>
          <input type="datetime-local" value={values.startsAt} onChange={(e) => set("startsAt", e.target.value)} style={{ ...inputStyle, width: "100%" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Ends At</label>
          <input type="datetime-local" value={values.endsAt} onChange={(e) => set("endsAt", e.target.value)} style={{ ...inputStyle, width: "100%" }} />
        </div>
      </div>

      <div style={{ marginBottom: "0.75rem" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", marginBottom: values.isRecurring ? "0.5rem" : 0 }}>
          <input type="checkbox" checked={values.isRecurring} onChange={(e) => set("isRecurring", e.target.checked)} />
          Recurring
        </label>
        {values.isRecurring && (
          <>
            <select value={values.recurrenceRule} onChange={(e) => set("recurrenceRule", e.target.value as FormValues["recurrenceRule"])} style={inputStyle}>
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly (same weekday)</option>
              <option value="Monthly">Monthly (same day of month)</option>
            </select>
            <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", marginTop: "0.3rem" }}>
              Repeats using the time-of-day and duration between the Starts/Ends At above, on every {values.recurrenceRule === "Daily" ? "day" : values.recurrenceRule === "Weekly" ? "matching weekday" : "matching day of month"} from the start date onward.
            </p>
          </>
        )}
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.3rem" }}>Monitors covered by this window</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", maxHeight: 220, overflowY: "auto" }}>
          {monitors.map((m) => (
            <label key={`${m.kind}-${m.id}`} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.82rem", border: "1px solid var(--border)", borderRadius: 6, padding: "0.25rem 0.5rem" }}>
              <input type="checkbox" checked={values.monitorIds.includes(m.id)} onChange={() => toggleMonitor(m.id)} />
              {m.name} <span style={{ color: "var(--ink-muted)" }}>({m.kind})</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Button onClick={save} disabled={submitting}>
          {submitting ? "Saving..." : "Save Window"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

function MaintenanceWindowsInner() {
  const toast = useToast();
  const [windows, setWindows] = useState<WindowRow[] | null>(null);
  const [monitors, setMonitors] = useState<MonitorOption[]>([]);
  const [editing, setEditing] = useState<{ id: number | "new"; values: FormValues } | null>(null);

  const load = useCallback(async () => {
    const [winRes, webRes, apiRes] = await Promise.all([
      fetch("/api/admin/monitoring/maintenance"),
      fetch("/api/admin/monitoring/websites"),
      fetch("/api/admin/monitoring/api"),
    ]);
    const winData = await winRes.json();
    const webData = await webRes.json();
    const apiData = await apiRes.json();
    if (winRes.ok && winData.ok) setWindows(winData.data);
    const webMonitors: MonitorOption[] = webRes.ok && webData.ok ? webData.data.map((m: { id: number; name: string }) => ({ id: m.id, name: m.name, kind: "Website" as const })) : [];
    const apiMonitors: MonitorOption[] = apiRes.ok && apiData.ok ? apiData.data.map((m: { id: number; name: string }) => ({ id: m.id, name: m.name, kind: "API" as const })) : [];
    setMonitors([...webMonitors, ...apiMonitors]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(row: WindowRow) {
    const res = await fetch(`/api/admin/monitoring/maintenance/${row.Id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to delete maintenance window." });
      return;
    }
    toast.show({ type: "success", message: `${row.Name} deleted.` });
    await load();
  }

  return (
    <div>
      {editing ? (
        <WindowForm
          id={editing.id}
          initial={editing.values}
          monitors={monitors}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <div style={{ marginBottom: "1rem" }}>
          <Button onClick={() => setEditing({ id: "new", values: DEFAULT_FORM })}>New Maintenance Window</Button>
        </div>
      )}

      <div className="dash-panel">
        {windows === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : windows.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No maintenance windows yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}>Name</th>
                  <th style={{ padding: "0.4rem" }}>Starts</th>
                  <th style={{ padding: "0.4rem" }}>Ends</th>
                  <th style={{ padding: "0.4rem" }}>Recurs</th>
                  <th style={{ padding: "0.4rem" }}>Monitors</th>
                  <th style={{ padding: "0.4rem" }}>Active</th>
                  <th style={{ padding: "0.4rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {windows.map((w) => (
                  <tr key={w.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>{w.Name}</td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(w.StartsAt).toLocaleString()}</td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(w.EndsAt).toLocaleString()}</td>
                    <td style={{ padding: "0.4rem" }}>{w.IsRecurring ? w.RecurrenceRule : "No"}</td>
                    <td style={{ padding: "0.4rem" }}>{w.monitorIds.length}</td>
                    <td style={{ padding: "0.4rem" }}>{w.IsActive ? "Yes" : "No"}</td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        <Button size="sm" variant="secondary" onClick={() => setEditing({ id: w.Id, values: toFormValues(w) })}>
                          Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => remove(w)}>
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

export function MaintenanceWindowsClient() {
  return (
    <ToastProvider>
      <MaintenanceWindowsInner />
    </ToastProvider>
  );
}
