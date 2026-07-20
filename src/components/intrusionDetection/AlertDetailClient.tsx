"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ALERT_STATUSES, type AlertStatus } from "@/lib/intrusionDetection/shared";

interface AlertDetail {
  Id: number;
  RuleId: number | null;
  RuleName: string | null;
  RuleDescription: string | null;
  RuleTags: string | null;
  RuleReferences: string | null;
  ProtectedApplicationName: string | null;
  Category: string;
  Severity: string;
  Confidence: number;
  RiskScore: number;
  SourceIp: string | null;
  DestinationHost: string | null;
  RequestMethod: string | null;
  RequestPath: string | null;
  ResponseStatus: number | null;
  UserAgent: string | null;
  UserAccount: string | null;
  EvidenceSummary: string | null;
  RecommendedAction: string | null;
  Status: AlertStatus;
  OccurrenceCount: number;
  FirstSeenAt: string;
  LastSeenAt: string;
  CreatedAt: string;
}

interface NoteRow {
  Id: number;
  Username: string | null;
  Note: string;
  CreatedAt: string;
}
interface HistoryRow {
  Id: number;
  OldStatus: string | null;
  NewStatus: string;
  ChangedByUsername: string | null;
  Reason: string | null;
  ChangedAt: string;
}
interface EventRow {
  Id: number;
  DataSource: string;
  EventTime: string;
  SourceIp: string | null;
  RequestMethod: string | null;
  RequestPath: string | null;
  ResponseStatus: number | null;
  EvidenceSummary: string | null;
}
interface RelatedAlertRow {
  Id: number;
  Category: string;
  Severity: string;
  Status: string;
  CreatedAt: string;
}
interface IpProfile {
  TotalEvents: number;
  TotalAlerts: number;
  FirstSeenAt: string;
}

function severityColor(s: string): string {
  if (s === "critical" || s === "high") return "var(--danger)";
  if (s === "medium" || s === "low") return "var(--warning)";
  return "var(--ink-muted)";
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.35rem 0", borderBottom: "1px solid var(--grid)" }}>
      <span style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>{label}</span>
      <span style={{ fontSize: "0.85rem", fontWeight: 500, textAlign: "right", maxWidth: "60%", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

export default function AlertDetailClient({ alertId }: { alertId: number }) {
  const [alert, setAlert] = useState<AlertDetail | null>(null);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [related, setRelated] = useState<RelatedAlertRow[]>([]);
  const [ipProfile, setIpProfile] = useState<IpProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [pendingStatus, setPendingStatus] = useState<AlertStatus | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/intrusion-detection/alerts/${alertId}`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Failed to load alert.");
      setLoading(false);
      return;
    }
    setAlert(data.data.alert);
    setNotes(data.data.notes);
    setHistory(data.data.statusHistory);
    setEvents(data.data.events);
    setRelated(data.data.relatedAlerts);
    setIpProfile(data.data.ipProfile);
    setLoading(false);
  }, [alertId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addNote() {
    if (!newNote.trim()) return;
    await fetch(`/api/admin/intrusion-detection/alerts/${alertId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: newNote.trim() }),
    });
    setNewNote("");
    load();
  }

  async function confirmStatusChange() {
    if (!pendingStatus) return;
    await fetch(`/api/admin/intrusion-detection/alerts/${alertId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: pendingStatus, reason: statusReason.trim() || null }),
    });
    setPendingStatus(null);
    setStatusReason("");
    load();
  }

  if (loading) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;
  if (error || !alert) return <p style={{ color: "var(--danger)" }}>{error ?? "Alert not found."}</p>;

  return (
    <div>
      <Link href="/dashboard/security" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ink-muted)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
        <ArrowLeft size={14} /> Back to Intrusion Detection
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Alert #{alert.Id}</h1>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            textTransform: "uppercase",
            padding: "0.25rem 0.6rem",
            borderRadius: 999,
            color: severityColor(alert.Severity),
            background: `color-mix(in srgb, ${severityColor(alert.Severity)} 16%, transparent)`,
            border: `1px solid color-mix(in srgb, ${severityColor(alert.Severity)} 40%, transparent)`,
          }}
        >
          {alert.Severity}
        </span>
        <span style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>Status: {alert.Status}</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4" style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1fr 340px" }}>
        <div style={{ display: "grid", gap: "1rem" }}>
          <div className="dash-panel">
            <h2 style={{ fontSize: "0.95rem", marginTop: 0 }}>{alert.RuleName ?? "Unknown rule"}</h2>
            {alert.RuleDescription && <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>{alert.RuleDescription}</p>}
            <Row label="Category" value={alert.Category} />
            <Row label="Confidence" value={`${alert.Confidence}/100`} />
            <Row label="Risk Score" value={`${alert.RiskScore}/100`} />
            <Row label="Protected Application" value={alert.ProtectedApplicationName ?? "-"} />
            <Row label="Source IP" value={alert.SourceIp ?? "-"} />
            <Row label="Destination Host" value={alert.DestinationHost ?? "-"} />
            <Row label="Method / Path" value={`${alert.RequestMethod ?? "-"} ${alert.RequestPath ?? ""}`} />
            <Row label="Response Status" value={alert.ResponseStatus ?? "-"} />
            <Row label="User Agent" value={alert.UserAgent ?? "-"} />
            <Row label="User Account" value={alert.UserAccount ?? "-"} />
            <Row label="First Seen" value={new Date(alert.FirstSeenAt).toLocaleString()} />
            <Row label="Last Seen" value={new Date(alert.LastSeenAt).toLocaleString()} />
            <Row label="Occurrences" value={alert.OccurrenceCount} />
            {alert.EvidenceSummary && (
              <div style={{ marginTop: "0.75rem" }}>
                <div style={{ color: "var(--ink-muted)", fontSize: "0.8rem", marginBottom: "0.25rem" }}>Evidence</div>
                <pre style={{ background: "var(--surface-2)", padding: "0.6rem", borderRadius: 8, fontSize: "0.78rem", whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
                  {alert.EvidenceSummary}
                </pre>
              </div>
            )}
            {alert.RecommendedAction && (
              <div style={{ marginTop: "0.75rem" }}>
                <div style={{ color: "var(--ink-muted)", fontSize: "0.8rem", marginBottom: "0.25rem" }}>Recommended Action</div>
                <p style={{ fontSize: "0.82rem", margin: 0 }}>{alert.RecommendedAction}</p>
              </div>
            )}
          </div>

          <div className="dash-panel">
            <h3 style={{ fontSize: "0.9rem", marginTop: 0 }}>Contributing Events ({events.length})</h3>
            {events.length === 0 ? (
              <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No linked events.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                      <th style={{ padding: "0.3rem" }}>Time</th>
                      <th style={{ padding: "0.3rem" }}>Source</th>
                      <th style={{ padding: "0.3rem" }}>IP</th>
                      <th style={{ padding: "0.3rem" }}>Path</th>
                      <th style={{ padding: "0.3rem" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                        <td style={{ padding: "0.3rem", whiteSpace: "nowrap" }}>{new Date(e.EventTime).toLocaleString()}</td>
                        <td style={{ padding: "0.3rem" }}>{e.DataSource}</td>
                        <td style={{ padding: "0.3rem" }}>{e.SourceIp ?? "-"}</td>
                        <td style={{ padding: "0.3rem", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.RequestPath ?? "-"}</td>
                        <td style={{ padding: "0.3rem" }}>{e.ResponseStatus ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="dash-panel">
            <h3 style={{ fontSize: "0.9rem", marginTop: 0 }}>Analyst Notes</h3>
            <div style={{ display: "grid", gap: "0.5rem", marginBottom: "0.75rem" }}>
              {notes.length === 0 ? (
                <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No notes yet.</p>
              ) : (
                notes.map((n) => (
                  <div key={n.Id} style={{ fontSize: "0.82rem", borderLeft: "3px solid var(--border)", paddingLeft: "0.6rem" }}>
                    <div style={{ color: "var(--ink-muted)", fontSize: "0.72rem" }}>
                      {n.Username ?? "Unknown"} &middot; {new Date(n.CreatedAt).toLocaleString()}
                    </div>
                    <div>{n.Note}</div>
                  </div>
                ))
              )}
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add an investigation note..."
                rows={2}
                style={{ flex: 1, padding: "0.5rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--plane)", color: "var(--ink)", fontSize: "0.82rem" }}
              />
              <button className="submit" onClick={addNote} style={{ width: "auto", marginTop: 0, alignSelf: "flex-end" }}>
                Add
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: "1rem", alignContent: "start" }}>
          <div className="dash-panel">
            <h3 style={{ fontSize: "0.9rem", marginTop: 0 }}>Update Status</h3>
            <div style={{ display: "grid", gap: "0.4rem" }}>
              {ALERT_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={s === alert.Status}
                  onClick={() => setPendingStatus(s)}
                  style={{
                    padding: "0.4rem 0.6rem",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: s === alert.Status ? "var(--surface-2)" : "var(--plane)",
                    color: s === alert.Status ? "var(--ink-muted)" : "var(--ink)",
                    cursor: s === alert.Status ? "default" : "pointer",
                    fontSize: "0.82rem",
                    textAlign: "left",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            {pendingStatus && (
              <div style={{ marginTop: "0.75rem", padding: "0.6rem", border: "1px solid var(--border)", borderRadius: 8 }}>
                <p style={{ fontSize: "0.8rem", margin: "0 0 0.4rem" }}>
                  Change status to <strong>{pendingStatus}</strong>?
                </p>
                <input
                  placeholder="Reason (optional)"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  style={{ width: "100%", padding: "0.4rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--plane)", color: "var(--ink)", fontSize: "0.8rem", marginBottom: "0.5rem" }}
                />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="submit" onClick={confirmStatusChange} style={{ width: "auto", marginTop: 0, padding: "0.35rem 0.8rem", fontSize: "0.8rem" }}>
                    Confirm
                  </button>
                  <button onClick={() => setPendingStatus(null)} style={{ padding: "0.35rem 0.8rem", fontSize: "0.8rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--plane)", color: "var(--ink)", cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {ipProfile && (
            <div className="dash-panel">
              <h3 style={{ fontSize: "0.9rem", marginTop: 0 }}>Source IP History</h3>
              <Row label="Total Events" value={ipProfile.TotalEvents} />
              <Row label="Total Alerts" value={ipProfile.TotalAlerts} />
              <Row label="First Seen" value={new Date(ipProfile.FirstSeenAt).toLocaleString()} />
            </div>
          )}

          <div className="dash-panel">
            <h3 style={{ fontSize: "0.9rem", marginTop: 0 }}>Related Alerts (same IP)</h3>
            {related.length === 0 ? (
              <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>None.</p>
            ) : (
              <div style={{ display: "grid", gap: "0.4rem" }}>
                {related.map((r) => (
                  <Link key={r.Id} href={`/dashboard/security/alerts/${r.Id}`} style={{ fontSize: "0.8rem", color: "var(--primary)" }}>
                    #{r.Id} - {r.Category} ({r.Severity}) - {r.Status}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="dash-panel">
            <h3 style={{ fontSize: "0.9rem", marginTop: 0 }}>Status History</h3>
            {history.length === 0 ? (
              <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No changes yet.</p>
            ) : (
              <div style={{ display: "grid", gap: "0.4rem" }}>
                {history.map((h) => (
                  <div key={h.Id} style={{ fontSize: "0.78rem" }}>
                    <div>
                      {h.OldStatus ?? "(created)"} &rarr; <strong>{h.NewStatus}</strong>
                    </div>
                    <div style={{ color: "var(--ink-muted)" }}>
                      {h.ChangedByUsername ?? "System"} &middot; {new Date(h.ChangedAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
