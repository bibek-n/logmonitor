"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
      }}
    >
      {children}
    </span>
  );
}

interface IncidentDetail {
  id: number;
  title: string;
  severity: string;
  affectedSystem: string | null;
  status: string;
  ownerUserId: number | null;
  ownerUsername: string | null;
  startedAt: string;
  acknowledgedAt: string | null;
  acknowledgedByUsername: string | null;
  resolvedAt: string | null;
  resolvedByUsername: string | null;
  rootCause: string | null;
  fix: string | null;
  prevention: string | null;
  linkedAlerts: { id: number; category: string; severity: string; status: string; createdAt: string }[];
  linkedMonitorIncidents: { id: number; title: string; monitorName: string; severity: string; status: string }[];
  timeline: { id: number; entryType: string; message: string; username: string | null; createdAt: string }[];
  attachments: { id: number; originalFileName: string; contentType: string | null; sizeBytes: number; uploadedByUsername: string | null; createdAt: string }[];
}

interface UserOption {
  Id: number;
  Username: string;
}

interface KbSuggestion {
  id: number;
  title: string;
  category: string;
  matchedKeywords: string[];
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function IncidentDetailInner({ incidentId }: { incidentId: number }) {
  const toast = useToast();
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [kbSuggestions, setKbSuggestions] = useState<KbSuggestion[] | null>(null);
  const [newNote, setNewNote] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [fix, setFix] = useState("");
  const [prevention, setPrevention] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/ops-incidents/${incidentId}`);
    const data = await res.json();
    if (res.ok && data.ok) {
      setIncident(data.data);
      setRootCause(data.data.rootCause ?? "");
      setFix(data.data.fix ?? "");
      setPrevention(data.data.prevention ?? "");
    }
  }, [incidentId]);

  useEffect(() => {
    load();
    fetch("/api/admin/ops-incidents/users")
      .then((r) => r.json())
      .then((d) => d.ok && setUsers(d.data));
    fetch(`/api/admin/ops-incidents/${incidentId}/kb-suggestions`)
      .then((r) => r.json())
      .then((d) => d.ok && setKbSuggestions(d.data));
  }, [load, incidentId]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/ops-incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Update failed.");
      setIncident(data.data);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Update failed." });
    } finally {
      setBusy(false);
    }
  }

  async function acknowledge() {
    await fetch(`/api/admin/ops-incidents/${incidentId}/acknowledge`, { method: "POST" });
    await load();
  }
  async function resolve() {
    await fetch(`/api/admin/ops-incidents/${incidentId}/resolve`, { method: "POST" });
    await load();
    toast.show({ type: "success", message: "Incident resolved." });
  }
  async function addNote() {
    if (!newNote.trim()) return;
    await fetch(`/api/admin/ops-incidents/${incidentId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: newNote.trim() }),
    });
    setNewNote("");
    await load();
  }
  async function saveSummary() {
    await patch({ rootCause, fix, prevention });
    toast.show({ type: "success", message: "Post-incident summary saved." });
  }
  async function uploadAttachment(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/admin/ops-incidents/${incidentId}/attachments`, { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Upload failed." });
      return;
    }
    await load();
  }
  async function deleteAttachment(attachmentId: number) {
    await fetch(`/api/admin/ops-incidents/${incidentId}/attachments/${attachmentId}`, { method: "DELETE" });
    await load();
  }
  async function saveAsKbArticle() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/ops-incidents/${incidentId}/save-as-kb-article`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save as KB article.");
      toast.show({ type: "success", message: "Saved as a Knowledge Base article." });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to save as KB article." });
    } finally {
      setBusy(false);
    }
  }

  if (!incident) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;

  return (
    <div>
      <Link href="/dashboard/incidents" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ink-muted)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
        <ArrowLeft size={14} /> Back to Incidents
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Incident #{incident.id}</h1>
        <Badge tone={severityColor(incident.severity)}>{incident.severity}</Badge>
        <span style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>{incident.title}</span>
        <a href={`/api/admin/ops-incidents/${incident.id}/pdf`} style={{ marginLeft: "auto", fontSize: "0.82rem", color: "var(--primary)" }}>
          Download PDF
        </a>
      </div>

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1fr 340px" }}>
        <div style={{ display: "grid", gap: "1rem" }}>
          <div className="dash-panel">
            <h3 style={{ fontSize: "0.9rem", marginTop: 0 }}>Overview</h3>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
              <select value={incident.status} disabled={busy} onChange={(e) => patch({ status: e.target.value })} style={inputStyle}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select value={incident.severity} disabled={busy} onChange={(e) => patch({ severity: e.target.value })} style={inputStyle}>
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select value={incident.ownerUserId ?? ""} disabled={busy} onChange={(e) => patch({ ownerUserId: e.target.value ? Number(e.target.value) : null })} style={inputStyle}>
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.Id} value={u.Id}>
                    {u.Username}
                  </option>
                ))}
              </select>
            </div>
            <input
              defaultValue={incident.affectedSystem ?? ""}
              placeholder="Affected system or website"
              onBlur={(e) => patch({ affectedSystem: e.target.value || null })}
              style={{ ...inputStyle, width: "100%", marginBottom: "0.6rem" }}
            />
            <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.82rem", color: "var(--ink-muted)" }}>
              <span>Started {new Date(incident.startedAt).toLocaleString()}</span>
              {incident.acknowledgedAt && <span>&middot; Acknowledged by {incident.acknowledgedByUsername} at {new Date(incident.acknowledgedAt).toLocaleString()}</span>}
              {incident.resolvedAt && <span>&middot; Resolved by {incident.resolvedByUsername} at {new Date(incident.resolvedAt).toLocaleString()}</span>}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
              {!incident.acknowledgedAt && (
                <button type="button" className="submit" onClick={acknowledge} style={{ width: "auto", marginTop: 0, padding: "0.35rem 0.8rem", fontSize: "0.8rem" }}>
                  Acknowledge
                </button>
              )}
              {!incident.resolvedAt && (
                <button type="button" className="submit" onClick={resolve} style={{ width: "auto", marginTop: 0, padding: "0.35rem 0.8rem", fontSize: "0.8rem" }}>
                  Resolve
                </button>
              )}
            </div>
          </div>

          <div className="dash-panel">
            <h3 style={{ fontSize: "0.9rem", marginTop: 0 }}>Post-Incident Summary</h3>
            <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>Root Cause</label>
            <textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={2} style={{ ...inputStyle, width: "100%", marginBottom: "0.5rem" }} />
            <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>Fix</label>
            <textarea value={fix} onChange={(e) => setFix(e.target.value)} rows={2} style={{ ...inputStyle, width: "100%", marginBottom: "0.5rem" }} />
            <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>Prevention</label>
            <textarea value={prevention} onChange={(e) => setPrevention(e.target.value)} rows={2} style={{ ...inputStyle, width: "100%", marginBottom: "0.5rem" }} />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" className="submit" onClick={saveSummary} disabled={busy} style={{ width: "auto", marginTop: 0, padding: "0.35rem 0.8rem", fontSize: "0.8rem" }}>
                Save Summary
              </button>
              <button type="button" onClick={saveAsKbArticle} disabled={busy} style={{ padding: "0.35rem 0.8rem", fontSize: "0.8rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--plane)", color: "var(--ink)", cursor: "pointer" }}>
                Save as KB Article
              </button>
            </div>
          </div>

          <div className="dash-panel">
            <h3 style={{ fontSize: "0.9rem", marginTop: 0 }}>Timeline</h3>
            <div style={{ display: "grid", gap: "0.5rem", marginBottom: "0.75rem", maxHeight: 280, overflowY: "auto" }}>
              {incident.timeline.map((t) => (
                <div key={t.id} style={{ fontSize: "0.82rem", borderLeft: "3px solid var(--border)", paddingLeft: "0.6rem" }}>
                  <div style={{ color: "var(--ink-muted)", fontSize: "0.72rem" }}>
                    {t.username ?? "System"} &middot; {new Date(t.createdAt).toLocaleString()} &middot; {t.entryType}
                  </div>
                  <div>{t.message}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                style={{ flex: 1, padding: "0.5rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--plane)", color: "var(--ink)", fontSize: "0.82rem" }}
              />
              <button type="button" className="submit" onClick={addNote} style={{ width: "auto", marginTop: 0, alignSelf: "flex-end" }}>
                Add
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: "1rem", alignContent: "start" }}>
          {kbSuggestions && kbSuggestions.length > 0 && (
            <div className="dash-panel">
              <h3 style={{ fontSize: "0.9rem", marginTop: 0 }}>Suggested KB Articles</h3>
              <div style={{ display: "grid", gap: "0.4rem" }}>
                {kbSuggestions.map((k) => (
                  <div key={k.id} style={{ fontSize: "0.8rem" }}>
                    <div>{k.title}</div>
                    <div style={{ color: "var(--ink-muted)", fontSize: "0.72rem" }}>
                      {k.category} &middot; matched: {k.matchedKeywords.join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(incident.linkedAlerts.length > 0 || incident.linkedMonitorIncidents.length > 0) && (
            <div className="dash-panel">
              <h3 style={{ fontSize: "0.9rem", marginTop: 0 }}>Linked Alerts</h3>
              <div style={{ display: "grid", gap: "0.4rem" }}>
                {incident.linkedAlerts.map((a) => (
                  <Link key={a.id} href="/dashboard/security" style={{ fontSize: "0.8rem", color: "var(--primary)" }}>
                    #{a.id} - {a.category} ({a.severity}) - {a.status}
                  </Link>
                ))}
                {incident.linkedMonitorIncidents.map((m) => (
                  <Link key={m.id} href="/dashboard/monitoring/incidents" style={{ fontSize: "0.8rem", color: "var(--primary)" }}>
                    {m.monitorName}: {m.title} ({m.severity}) - {m.status}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="dash-panel">
            <h3 style={{ fontSize: "0.9rem", marginTop: 0 }}>Attachments</h3>
            <div style={{ display: "grid", gap: "0.4rem", marginBottom: "0.6rem" }}>
              {incident.attachments.length === 0 ? (
                <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem", margin: 0 }}>No attachments yet.</p>
              ) : (
                incident.attachments.map((a) => (
                  <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem" }}>
                    <a href={`/api/admin/ops-incidents/${incident.id}/attachments/${a.id}`} target="_blank" rel="noreferrer" style={{ color: "var(--primary)" }}>
                      {a.originalFileName}
                    </a>
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <span style={{ color: "var(--ink-muted)", fontSize: "0.72rem" }}>{formatBytes(a.sizeBytes)}</span>
                      <button type="button" onClick={() => deleteAttachment(a.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.75rem" }}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadAttachment(file);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              style={{ fontSize: "0.78rem" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IncidentDetailClient({ incidentId }: { incidentId: number }) {
  return (
    <ToastProvider>
      <IncidentDetailInner incidentId={incidentId} />
    </ToastProvider>
  );
}
