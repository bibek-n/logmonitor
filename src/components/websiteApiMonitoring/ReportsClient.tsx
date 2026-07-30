"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

const inputStyle = {
  padding: "0.5rem 0.7rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

// --- On-demand export ---

function ExportPanel() {
  function download(format: "csv" | "excel" | "pdf") {
    window.open(`/api/admin/monitoring/reports/export?format=${format}`, "_blank");
  }
  return (
    <Card style={{ marginBottom: "1rem" }}>
      <h2 style={{ fontSize: "1rem", marginTop: 0 }}>Export Current Status</h2>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem", marginTop: 0 }}>
        Downloads a snapshot of every website and API monitor - status, 7-day uptime, last response time, and open incidents.
      </p>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Button variant="secondary" onClick={() => download("csv")}>
          Download CSV
        </Button>
        <Button variant="secondary" onClick={() => download("excel")}>
          Download Excel
        </Button>
        <Button variant="secondary" onClick={() => download("pdf")}>
          Download PDF
        </Button>
      </div>
    </Card>
  );
}

// --- Scheduled reports ---

interface ContactOption {
  Id: number;
  Name: string;
  ContactType: string;
}
interface MonitorOption {
  id: number;
  name: string;
  kind: "Website" | "API";
}
interface ScheduledReportRow {
  Id: number;
  Name: string;
  Frequency: "Daily" | "Weekly" | "Monthly";
  Format: "Email" | "Csv" | "Pdf" | "Excel";
  MonitorScope: "All" | "Selected";
  RecipientEmails: string | null;
  IsActive: boolean;
  LastSentAt: string | null;
  NextSendAt: string | null;
  contactIds: number[];
  monitorIds: number[];
}

interface ScheduledReportForm {
  name: string;
  frequency: "Daily" | "Weekly" | "Monthly";
  format: "Email" | "Csv" | "Pdf" | "Excel";
  monitorScope: "All" | "Selected";
  monitorIds: number[];
  contactIds: number[];
  recipientEmails: string;
  isActive: boolean;
}

const DEFAULT_SCHEDULED_FORM: ScheduledReportForm = {
  name: "",
  frequency: "Weekly",
  format: "Email",
  monitorScope: "All",
  monitorIds: [],
  contactIds: [],
  recipientEmails: "",
  isActive: true,
};

function toForm(r: ScheduledReportRow): ScheduledReportForm {
  return {
    name: r.Name,
    frequency: r.Frequency,
    format: r.Format,
    monitorScope: r.MonitorScope,
    monitorIds: r.monitorIds,
    contactIds: r.contactIds,
    recipientEmails: r.RecipientEmails ?? "",
    isActive: r.IsActive,
  };
}

function ScheduledReportForm({
  id,
  initial,
  contacts,
  monitors,
  onSaved,
  onCancel,
}: {
  id: number | "new";
  initial: ScheduledReportForm;
  contacts: ContactOption[];
  monitors: MonitorOption[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [values, setValues] = useState<ScheduledReportForm>(initial);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof ScheduledReportForm>(key: K, val: ScheduledReportForm[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function save() {
    if (!values.name.trim()) {
      toast.show({ type: "error", message: "Name is required." });
      return;
    }
    setSubmitting(true);
    try {
      const isNew = id === "new";
      const res = await fetch(isNew ? "/api/admin/monitoring/scheduled-reports" : `/api/admin/monitoring/scheduled-reports/${id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, recipientEmails: values.recipientEmails.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save scheduled report.");
      toast.show({ type: "success", message: "Scheduled report saved." });
      onSaved();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to save scheduled report." });
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Frequency</label>
          <select value={values.frequency} onChange={(e) => set("frequency", e.target.value as ScheduledReportForm["frequency"])} style={inputStyle}>
            <option value="Daily">Daily</option>
            <option value="Weekly">Weekly</option>
            <option value="Monthly">Monthly</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Format</label>
          <select value={values.format} onChange={(e) => set("format", e.target.value as ScheduledReportForm["format"])} style={inputStyle}>
            <option value="Email">Email body only</option>
            <option value="Csv">Email + CSV attachment</option>
            <option value="Excel">Email + Excel attachment</option>
            <option value="Pdf">Email + PDF attachment</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Monitors</label>
          <select value={values.monitorScope} onChange={(e) => set("monitorScope", e.target.value as ScheduledReportForm["monitorScope"])} style={inputStyle}>
            <option value="All">All monitors</option>
            <option value="Selected">Selected monitors</option>
          </select>
        </div>
      </div>

      {values.monitorScope === "Selected" && (
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.3rem" }}>Selected Monitors</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", maxHeight: 180, overflowY: "auto" }}>
            {monitors.map((m) => (
              <label key={`${m.kind}-${m.id}`} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.82rem", border: "1px solid var(--border)", borderRadius: 6, padding: "0.25rem 0.5rem" }}>
                <input
                  type="checkbox"
                  checked={values.monitorIds.includes(m.id)}
                  onChange={() => set("monitorIds", values.monitorIds.includes(m.id) ? values.monitorIds.filter((x) => x !== m.id) : [...values.monitorIds, m.id])}
                />
                {m.name} <span style={{ color: "var(--ink-muted)" }}>({m.kind})</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: "0.75rem" }}>
        <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.3rem" }}>Recipients (Alert Contacts)</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {contacts
            .filter((c) => c.ContactType === "Email")
            .map((c) => (
              <label key={c.Id} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.82rem", border: "1px solid var(--border)", borderRadius: 6, padding: "0.25rem 0.5rem" }}>
                <input
                  type="checkbox"
                  checked={values.contactIds.includes(c.Id)}
                  onChange={() => set("contactIds", values.contactIds.includes(c.Id) ? values.contactIds.filter((x) => x !== c.Id) : [...values.contactIds, c.Id])}
                />
                {c.Name}
              </label>
            ))}
        </div>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Other recipient email(s)</label>
        <input value={values.recipientEmails} onChange={(e) => set("recipientEmails", e.target.value)} style={{ ...inputStyle, width: "100%" }} placeholder="one@example.com, another@example.com" />
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Button onClick={save} disabled={submitting}>
          {submitting ? "Saving..." : "Save"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

function ScheduledReportsPanel() {
  const toast = useToast();
  const [reports, setReports] = useState<ScheduledReportRow[] | null>(null);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [monitors, setMonitors] = useState<MonitorOption[]>([]);
  const [editing, setEditing] = useState<{ id: number | "new"; values: ScheduledReportForm } | null>(null);

  const load = useCallback(async () => {
    const [reportsRes, contactsRes, webRes, apiRes] = await Promise.all([
      fetch("/api/admin/monitoring/scheduled-reports"),
      fetch("/api/admin/monitoring/alert-contacts"),
      fetch("/api/admin/monitoring/websites"),
      fetch("/api/admin/monitoring/api"),
    ]);
    const reportsData = await reportsRes.json();
    const contactsData = await contactsRes.json();
    const webData = await webRes.json();
    const apiData = await apiRes.json();
    if (reportsRes.ok && reportsData.ok) setReports(reportsData.data);
    if (contactsRes.ok && contactsData.ok) setContacts(contactsData.data);
    const webMonitors: MonitorOption[] = webRes.ok && webData.ok ? webData.data.map((m: { id: number; name: string }) => ({ id: m.id, name: m.name, kind: "Website" as const })) : [];
    const apiMonitors: MonitorOption[] = apiRes.ok && apiData.ok ? apiData.data.map((m: { id: number; name: string }) => ({ id: m.id, name: m.name, kind: "API" as const })) : [];
    setMonitors([...webMonitors, ...apiMonitors]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(row: ScheduledReportRow) {
    const res = await fetch(`/api/admin/monitoring/scheduled-reports/${row.Id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to delete scheduled report." });
      return;
    }
    toast.show({ type: "success", message: `${row.Name} deleted.` });
    await load();
  }

  return (
    <div style={{ marginBottom: "1rem" }}>
      <h2 style={{ fontSize: "1rem" }}>Scheduled Reports</h2>
      {editing ? (
        <ScheduledReportForm
          id={editing.id}
          initial={editing.values}
          contacts={contacts}
          monitors={monitors}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <div style={{ marginBottom: "0.75rem" }}>
          <Button onClick={() => setEditing({ id: "new", values: DEFAULT_SCHEDULED_FORM })}>New Scheduled Report</Button>
        </div>
      )}

      <div className="dash-panel">
        {reports === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : reports.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No scheduled reports yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}>Name</th>
                  <th style={{ padding: "0.4rem" }}>Frequency</th>
                  <th style={{ padding: "0.4rem" }}>Format</th>
                  <th style={{ padding: "0.4rem" }}>Last Sent</th>
                  <th style={{ padding: "0.4rem" }}>Next Send</th>
                  <th style={{ padding: "0.4rem" }}>Active</th>
                  <th style={{ padding: "0.4rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>{r.Name}</td>
                    <td style={{ padding: "0.4rem" }}>{r.Frequency}</td>
                    <td style={{ padding: "0.4rem" }}>{r.Format}</td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{r.LastSentAt ? new Date(r.LastSentAt).toLocaleString() : "Never"}</td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{r.NextSendAt ? new Date(r.NextSendAt).toLocaleString() : "-"}</td>
                    <td style={{ padding: "0.4rem" }}>{r.IsActive ? "Yes" : "No"}</td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        <Button size="sm" variant="secondary" onClick={() => setEditing({ id: r.Id, values: toForm(r) })}>
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

// --- SLA tracking ---

interface SlaRow {
  monitorId: number;
  monitorName: string;
  monitorType: string;
  targetPercent: number;
  evaluationWindow: "Daily" | "Weekly" | "Monthly";
  actualPercent: number | null;
  breached: boolean;
}

function SlaPanel() {
  const toast = useToast();
  const [rows, setRows] = useState<SlaRow[] | null>(null);
  const [monitors, setMonitors] = useState<MonitorOption[]>([]);
  const [monitorId, setMonitorId] = useState<number | "">("");
  const [targetPercent, setTargetPercent] = useState(99.9);
  const [evaluationWindow, setEvaluationWindow] = useState<"Daily" | "Weekly" | "Monthly">("Monthly");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const [slaRes, webRes, apiRes] = await Promise.all([fetch("/api/admin/monitoring/sla"), fetch("/api/admin/monitoring/websites"), fetch("/api/admin/monitoring/api")]);
    const slaData = await slaRes.json();
    if (slaRes.ok && slaData.ok) setRows(slaData.data);
    const webData = await webRes.json();
    const apiData = await apiRes.json();
    const webMonitors: MonitorOption[] = webRes.ok && webData.ok ? webData.data.map((m: { id: number; name: string }) => ({ id: m.id, name: m.name, kind: "Website" as const })) : [];
    const apiMonitors: MonitorOption[] = apiRes.ok && apiData.ok ? apiData.data.map((m: { id: number; name: string }) => ({ id: m.id, name: m.name, kind: "API" as const })) : [];
    setMonitors([...webMonitors, ...apiMonitors]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addOrUpdate() {
    if (!monitorId) {
      toast.show({ type: "error", message: "Pick a monitor first." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/monitoring/sla/${monitorId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPercent, evaluationWindow }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save SLA target.");
      toast.show({ type: "success", message: "SLA target saved." });
      setMonitorId("");
      await load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to save SLA target." });
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(row: SlaRow) {
    const res = await fetch(`/api/admin/monitoring/sla/${row.monitorId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to remove SLA tracking." });
      return;
    }
    toast.show({ type: "success", message: `SLA tracking removed for ${row.monitorName}.` });
    await load();
  }

  const trackedIds = new Set((rows ?? []).map((r) => r.monitorId));
  const availableMonitors = monitors.filter((m) => !trackedIds.has(m.id));

  return (
    <div>
      <h2 style={{ fontSize: "1rem" }}>SLA Targets</h2>
      <Card style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Monitor</label>
            <select value={monitorId} onChange={(e) => setMonitorId(e.target.value ? Number(e.target.value) : "")} style={{ ...inputStyle, minWidth: 220 }}>
              <option value="">Select a monitor...</option>
              {availableMonitors.map((m) => (
                <option key={`${m.kind}-${m.id}`} value={m.id}>
                  {m.name} ({m.kind})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Target %</label>
            <input type="number" step="0.01" min={0} max={100} value={targetPercent} onChange={(e) => setTargetPercent(Number(e.target.value))} style={{ ...inputStyle, width: 100 }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Window</label>
            <select value={evaluationWindow} onChange={(e) => setEvaluationWindow(e.target.value as "Daily" | "Weekly" | "Monthly")} style={inputStyle}>
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </div>
          <Button onClick={addOrUpdate} disabled={submitting}>
            Track SLA
          </Button>
        </div>
      </Card>

      <div className="dash-panel">
        {rows === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No monitors have an SLA target configured yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}>Monitor</th>
                  <th style={{ padding: "0.4rem" }}>Target</th>
                  <th style={{ padding: "0.4rem" }}>Window</th>
                  <th style={{ padding: "0.4rem" }}>Current</th>
                  <th style={{ padding: "0.4rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.monitorId} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>{r.monitorName}</td>
                    <td style={{ padding: "0.4rem" }}>{r.targetPercent}%</td>
                    <td style={{ padding: "0.4rem" }}>{r.evaluationWindow}</td>
                    <td style={{ padding: "0.4rem", color: r.breached ? "var(--danger)" : "var(--success)", fontWeight: 600 }}>
                      {r.actualPercent === null ? "-" : `${r.actualPercent.toFixed(2)}%`} {r.breached ? "(breached)" : ""}
                    </td>
                    <td style={{ padding: "0.4rem" }}>
                      <Button size="sm" variant="danger" onClick={() => remove(r)}>
                        Remove
                      </Button>
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

function ReportsInner() {
  return (
    <div>
      <ExportPanel />
      <ScheduledReportsPanel />
      <SlaPanel />
    </div>
  );
}

export function ReportsClient() {
  return (
    <ToastProvider>
      <ReportsInner />
    </ToastProvider>
  );
}
