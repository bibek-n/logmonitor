"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ToastProvider, useToast } from "@/components/ui/Toast";

const SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;
const STATUSES = ["Open", "Investigating", "Identified", "Monitoring", "Resolved", "Closed"] as const;

const inputStyle = {
  padding: "0.4rem 0.6rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--plane)",
  color: "var(--ink)",
  fontSize: "0.82rem",
};

function severityColor(s: string): string {
  if (s === "Critical" || s === "High") return "var(--danger)";
  if (s === "Medium") return "var(--warning)";
  return "var(--ink-muted)";
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: "0.72rem",
        fontWeight: 700,
        textTransform: "uppercase",
        padding: "0.2rem 0.55rem",
        borderRadius: 999,
        color: tone,
        background: `color-mix(in srgb, ${tone} 16%, transparent)`,
        border: `1px solid color-mix(in srgb, ${tone} 40%, transparent)`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

interface IncidentListRow {
  id: number;
  title: string;
  severity: string;
  affectedSystem: string | null;
  status: string;
  ownerUsername: string | null;
  startedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  linkedAlertCount: number;
}

interface UserOption {
  Id: number;
  Username: string;
}

interface OpenAlertOption {
  Id: number;
  Category: string;
  Severity: string;
  Status: string;
  SourceIp: string | null;
  CreatedAt: string;
}

function useOpsUsers() {
  const [users, setUsers] = useState<UserOption[]>([]);
  useEffect(() => {
    fetch("/api/admin/ops-incidents/users")
      .then((r) => r.json())
      .then((d) => d.ok && setUsers(d.data));
  }, []);
  return users;
}

function NewIncidentForm({ users, onCreated, onCancel }: { users: UserOption[]; onCreated: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("Medium");
  const [affectedSystem, setAffectedSystem] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [alertQuery, setAlertQuery] = useState("");
  const [alertOptions, setAlertOptions] = useState<OpenAlertOption[]>([]);
  const [selectedAlertIds, setSelectedAlertIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetch(`/api/admin/ops-incidents/open-alerts?q=${encodeURIComponent(alertQuery)}`)
        .then((r) => r.json())
        .then((d) => d.ok && setAlertOptions(d.data));
    }, 250);
    return () => clearTimeout(timeout);
  }, [alertQuery]);

  async function create() {
    if (!title.trim()) {
      toast.show({ type: "error", message: "Title is required." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/ops-incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          severity,
          affectedSystem: affectedSystem.trim() || null,
          ownerUserId: ownerUserId ? Number(ownerUserId) : null,
          alertIds: selectedAlertIds,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to create incident.");
      toast.show({ type: "success", message: "Incident created." });
      onCreated();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to create incident." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dash-panel" style={{ marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "0.92rem", marginTop: 0 }}>New Incident</h3>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "0.6rem", marginBottom: "0.6rem" }}>
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        <select value={severity} onChange={(e) => setSeverity(e.target.value as (typeof SEVERITIES)[number])} style={inputStyle}>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} style={inputStyle}>
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.Id} value={u.Id}>
              {u.Username}
            </option>
          ))}
        </select>
      </div>
      <input
        placeholder="Affected system or website (optional)"
        value={affectedSystem}
        onChange={(e) => setAffectedSystem(e.target.value)}
        style={{ ...inputStyle, width: "100%", marginBottom: "0.6rem" }}
      />

      <div style={{ marginBottom: "0.6rem" }}>
        <label style={{ fontSize: "0.8rem", color: "var(--ink-muted)", display: "block", marginBottom: "0.3rem" }}>
          Link open Security Alert(s) (optional)
        </label>
        <input placeholder="Search by category or source IP..." value={alertQuery} onChange={(e) => setAlertQuery(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
        <div style={{ maxHeight: 160, overflowY: "auto", marginTop: "0.4rem", display: "grid", gap: "0.2rem" }}>
          {alertOptions.map((a) => (
            <label key={a.Id} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem" }}>
              <input
                type="checkbox"
                checked={selectedAlertIds.includes(a.Id)}
                onChange={(e) => setSelectedAlertIds((prev) => (e.target.checked ? [...prev, a.Id] : prev.filter((id) => id !== a.Id)))}
              />
              #{a.Id} <Badge tone={severityColor(a.Severity)}>{a.Severity}</Badge> {a.Category} {a.SourceIp ? `- ${a.SourceIp}` : ""}
            </label>
          ))}
          {alertOptions.length === 0 && <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>No matching open alerts.</span>}
        </div>
        {selectedAlertIds.length > 0 && <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginTop: "0.3rem" }}>{selectedAlertIds.length} alert(s) selected</div>}
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button type="button" className="submit" onClick={create} disabled={submitting} style={{ width: "auto", marginTop: 0, padding: "0.4rem 1rem" }}>
          {submitting ? "Creating..." : "Create Incident"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{ padding: "0.4rem 1rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--plane)", color: "var(--ink)", cursor: "pointer", fontSize: "0.85rem" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function IncidentsTab() {
  const users = useOpsUsers();
  const [rows, setRows] = useState<IncidentListRow[] | null>(null);
  const [filters, setFilters] = useState({ status: "", severity: "" });
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    const sp = new URLSearchParams();
    if (filters.status) sp.set("status", filters.status);
    if (filters.severity) sp.set("severity", filters.severity);
    fetch(`/api/admin/ops-incidents?${sp}`)
      .then((r) => r.json())
      .then((d) => d.ok && setRows(d.data));
  }, [filters]);

  useEffect(() => load(), [load]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} style={inputStyle}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={filters.severity} onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value }))} style={inputStyle}>
            <option value="">All severities</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="submit" onClick={() => setShowForm((v) => !v)} style={{ width: "auto", marginTop: 0, padding: "0.4rem 1rem" }}>
          {showForm ? "Close" : "New Incident"}
        </button>
      </div>

      {showForm && (
        <NewIncidentForm
          users={users}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="dash-panel">
        {rows === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No incidents match these filters.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "0.4rem" }}>Severity</th>
                  <th style={{ padding: "0.4rem" }}>Title</th>
                  <th style={{ padding: "0.4rem" }}>Affected System</th>
                  <th style={{ padding: "0.4rem" }}>Status</th>
                  <th style={{ padding: "0.4rem" }}>Owner</th>
                  <th style={{ padding: "0.4rem" }}>Alerts</th>
                  <th style={{ padding: "0.4rem" }}>Started</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>
                      <Badge tone={severityColor(r.severity)}>{r.severity}</Badge>
                    </td>
                    <td style={{ padding: "0.4rem" }}>
                      <Link href={`/dashboard/incidents/${r.id}`} style={{ color: "var(--primary)" }}>
                        {r.title}
                      </Link>
                    </td>
                    <td style={{ padding: "0.4rem" }}>{r.affectedSystem ?? "-"}</td>
                    <td style={{ padding: "0.4rem" }}>{r.status}</td>
                    <td style={{ padding: "0.4rem" }}>{r.ownerUsername ?? "Unassigned"}</td>
                    <td style={{ padding: "0.4rem" }}>{r.linkedAlertCount}</td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(r.startedAt).toLocaleString()}</td>
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

interface MttaMttrReport {
  overall: { mttaMinutes: number | null; mttrMinutes: number | null; acknowledgedCount: number; resolvedCount: number };
  byMonth: { month: string; mttaMinutes: number | null; mttrMinutes: number | null }[];
  byPerson: { username: string; mttaMinutes: number | null; acknowledgedCount: number; mttrMinutes: number | null; resolvedCount: number }[];
}

function formatMinutes(m: number | null): string {
  if (m == null) return "-";
  if (m < 60) return `${Math.round(m)}m`;
  const hours = Math.floor(m / 60);
  return `${hours}h ${Math.round(m % 60)}m`;
}

function MetricsTab() {
  const [report, setReport] = useState<MttaMttrReport | null>(null);
  const [months, setMonths] = useState(6);

  useEffect(() => {
    fetch(`/api/admin/ops-incidents/metrics?months=${months}`)
      .then((r) => r.json())
      .then((d) => d.ok && setReport(d.data));
  }, [months]);

  if (!report) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "1rem" }}>
          <div className="dash-panel" style={{ minWidth: 160 }}>
            <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)", textTransform: "uppercase" }}>Mean Time to Acknowledge</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{formatMinutes(report.overall.mttaMinutes)}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>{report.overall.acknowledgedCount} acknowledged</div>
          </div>
          <div className="dash-panel" style={{ minWidth: 160 }}>
            <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)", textTransform: "uppercase" }}>Mean Time to Resolve</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{formatMinutes(report.overall.mttrMinutes)}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>{report.overall.resolvedCount} resolved</div>
          </div>
        </div>
        <select value={months} onChange={(e) => setMonths(Number(e.target.value))} style={inputStyle}>
          <option value={3}>Last 3 months</option>
          <option value={6}>Last 6 months</option>
          <option value={12}>Last 12 months</option>
        </select>
      </div>

      <div className="dash-panel">
        <h3 style={{ fontSize: "0.9rem", marginTop: 0 }}>By Month</h3>
        {report.byMonth.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No incidents in this window.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.4rem" }}>Month</th>
                <th style={{ padding: "0.4rem" }}>MTTA</th>
                <th style={{ padding: "0.4rem" }}>MTTR</th>
              </tr>
            </thead>
            <tbody>
              {report.byMonth.map((m) => (
                <tr key={m.month} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem" }}>{m.month}</td>
                  <td style={{ padding: "0.4rem" }}>{formatMinutes(m.mttaMinutes)}</td>
                  <td style={{ padding: "0.4rem" }}>{formatMinutes(m.mttrMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="dash-panel">
        <h3 style={{ fontSize: "0.9rem", marginTop: 0 }}>By Person</h3>
        {report.byPerson.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No acknowledged/resolved incidents in this window.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.4rem" }}>Person</th>
                <th style={{ padding: "0.4rem" }}>MTTA</th>
                <th style={{ padding: "0.4rem" }}>Acknowledged</th>
                <th style={{ padding: "0.4rem" }}>MTTR</th>
                <th style={{ padding: "0.4rem" }}>Resolved</th>
              </tr>
            </thead>
            <tbody>
              {report.byPerson.map((p) => (
                <tr key={p.username} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem" }}>{p.username}</td>
                  <td style={{ padding: "0.4rem" }}>{formatMinutes(p.mttaMinutes)}</td>
                  <td style={{ padding: "0.4rem" }}>{p.acknowledgedCount}</td>
                  <td style={{ padding: "0.4rem" }}>{formatMinutes(p.mttrMinutes)}</td>
                  <td style={{ padding: "0.4rem" }}>{p.resolvedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function IncidentsListInner() {
  const [tab, setTab] = useState<"incidents" | "metrics">("incidents");
  return (
    <div>
      <div style={{ display: "flex", gap: "0.4rem", borderBottom: "1px solid var(--border)", marginBottom: "1rem" }}>
        {(["incidents", "metrics"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "0.5rem 0.8rem",
              background: "none",
              border: "none",
              borderBottom: tab === t ? "2px solid var(--primary)" : "2px solid transparent",
              color: tab === t ? "var(--ink)" : "var(--ink-muted)",
              fontWeight: tab === t ? 600 : 400,
              cursor: "pointer",
              fontSize: "0.85rem",
              textTransform: "capitalize",
            }}
          >
            {t === "metrics" ? "MTTA / MTTR Metrics" : "Incidents"}
          </button>
        ))}
      </div>
      {tab === "incidents" ? <IncidentsTab /> : <MetricsTab />}
    </div>
  );
}

export function IncidentsListClient() {
  return (
    <ToastProvider>
      <IncidentsListInner />
    </ToastProvider>
  );
}
