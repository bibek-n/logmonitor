"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

const SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;

interface IncidentDetail {
  Id: number;
  MonitorId: number;
  Title: string;
  Severity: string;
  Status: string;
  FailureReason: string | null;
  HttpStatusCode: number | null;
  DowntimeSeconds: number | null;
  StartedAtFormatted: string;
  ResolvedAtFormatted: string | null;
  AcknowledgedAt: string | null;
  AcknowledgedByUserId: number | null;
  AssignedToUserId: number | null;
  MonitorName: string;
  MonitorType: "Website" | "Api";
}

interface NoteRow {
  Id: number;
  UserId: number;
  Username: string | null;
  Note: string;
  CreatedAt: string;
}

interface UserOption {
  Id: number;
  Username: string;
}

const inputStyle = {
  padding: "0.5rem 0.7rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

function IncidentDetailInner({ incidentId }: { incidentId: number }) {
  const toast = useToast();
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [notes, setNotes] = useState<NoteRow[] | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [newNote, setNewNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/monitoring/incidents/${incidentId}`);
    const data = await res.json();
    if (res.ok && data.ok) setIncident(data.data);
    const notesRes = await fetch(`/api/admin/monitoring/incidents/${incidentId}/notes`);
    const notesData = await notesRes.json();
    if (notesRes.ok && notesData.ok) setNotes(notesData.data);
  }, [incidentId]);

  useEffect(() => {
    load();
    fetch("/api/admin/monitoring/users")
      .then((r) => r.json())
      .then((d) => d.ok && setUsers(d.data));
  }, [load]);

  async function callAction(path: string, body?: unknown, successMessage?: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/monitoring/incidents/${incidentId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Action failed.");
      if (successMessage) toast.show({ type: "success", message: successMessage });
      await load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Action failed." });
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!newNote.trim()) return;
    await callAction("notes", { note: newNote.trim() });
    setNewNote("");
  }

  if (!incident) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;

  const monitorHref = incident.MonitorType === "Api" ? `/dashboard/monitoring/api/${incident.MonitorId}` : `/dashboard/monitoring/websites/${incident.MonitorId}`;
  const assignedUser = users.find((u) => u.Id === incident.AssignedToUserId);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>{incident.Title}</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        <Link href={monitorHref} style={{ color: "var(--series-1)" }}>
          {incident.MonitorName}
        </Link>
      </p>

      <div className="dash-panel" style={{ marginBottom: "1rem" }}>
        <table style={{ fontSize: "0.85rem", borderCollapse: "collapse", width: "100%" }}>
          <tbody>
            <tr>
              <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>Status</td>
              <td style={{ padding: "0.3rem 0" }}>{incident.Status}</td>
            </tr>
            <tr>
              <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>Severity</td>
              <td style={{ padding: "0.3rem 0" }}>
                <select
                  value={incident.Severity}
                  onChange={(e) => callAction("severity", { severity: e.target.value }, "Severity updated.")}
                  disabled={busy}
                  style={inputStyle}
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>Failure Reason</td>
              <td style={{ padding: "0.3rem 0" }}>{incident.FailureReason ?? "-"}</td>
            </tr>
            <tr>
              <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>HTTP Status Code</td>
              <td style={{ padding: "0.3rem 0" }}>{incident.HttpStatusCode ?? "-"}</td>
            </tr>
            <tr>
              <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>Started At</td>
              <td style={{ padding: "0.3rem 0" }}>{new Date(incident.StartedAtFormatted).toLocaleString()}</td>
            </tr>
            <tr>
              <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>Resolved At</td>
              <td style={{ padding: "0.3rem 0" }}>{incident.ResolvedAtFormatted ? new Date(incident.ResolvedAtFormatted).toLocaleString() : "Still open"}</td>
            </tr>
            <tr>
              <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>Downtime</td>
              <td style={{ padding: "0.3rem 0" }}>{incident.DowntimeSeconds != null ? `${Math.round(incident.DowntimeSeconds / 60)} minute(s)` : "-"}</td>
            </tr>
            <tr>
              <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>Acknowledged</td>
              <td style={{ padding: "0.3rem 0" }}>{incident.AcknowledgedAt ? new Date(incident.AcknowledgedAt).toLocaleString() : "Not yet"}</td>
            </tr>
            <tr>
              <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>Assigned To</td>
              <td style={{ padding: "0.3rem 0" }}>
                <select value={incident.AssignedToUserId ?? ""} onChange={(e) => callAction("assign", { userId: e.target.value ? Number(e.target.value) : null }, "Assignment updated.")} disabled={busy} style={inputStyle}>
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.Id} value={u.Id}>
                      {u.Username}
                    </option>
                  ))}
                </select>
                {assignedUser && <span style={{ marginLeft: "0.5rem", color: "var(--ink-muted)", fontSize: "0.8rem" }}>currently {assignedUser.Username}</span>}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {!incident.AcknowledgedAt && (
          <Button onClick={() => callAction("acknowledge", {}, "Incident acknowledged.")} disabled={busy}>
            Acknowledge
          </Button>
        )}
        {incident.Status === "Open" ? (
          <Button variant="secondary" onClick={() => callAction("resolve", {}, "Incident resolved.")} disabled={busy}>
            Manually Resolve
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => callAction("reopen", {}, "Incident reopened.")} disabled={busy}>
            Reopen
          </Button>
        )}
      </div>

      <div className="dash-panel">
        <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.75rem" }}>Notes</h2>
        {notes === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : notes.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No notes yet.</p>
        ) : (
          <ul style={{ margin: 0, marginBottom: "0.75rem", paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
            {notes.map((n) => (
              <li key={n.Id} style={{ marginBottom: "0.4rem" }}>
                <strong>{n.Username ?? "Unknown"}</strong> - {new Date(n.CreatedAt).toLocaleString()}
                <div>{n.Note}</div>
              </li>
            ))}
          </ul>
        )}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input value={newNote} onChange={(e) => setNewNote(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Add a note..." />
          <Button onClick={addNote} disabled={busy || !newNote.trim()}>
            Add Note
          </Button>
        </div>
      </div>
    </div>
  );
}

export function IncidentDetailClient({ incidentId }: { incidentId: number }) {
  return (
    <ToastProvider>
      <IncidentDetailInner incidentId={incidentId} />
    </ToastProvider>
  );
}
