"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SidePanel } from "@/components/ui/SidePanel";
import { useToast } from "@/components/ui/Toast";
import { parseJsonResponse } from "@/lib/apiFetch";
import { formatUtcTimestamp } from "@/lib/formatUtcTimestamp";
import { INCIDENT_SEVERITIES, INCIDENT_STATUSES, STEP_TYPES } from "@/lib/serverRoom/constants";
import { inputStyle, th, td, type Tone } from "@/components/securityUpdates/shared";
import { postJson, useServerRoomOptions } from "./useOptions";

interface IncidentRow {
  number: string;
  title: string;
  severity: string;
  status: string;
  device: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  steps: number;
}

interface IncidentDetail {
  number: string;
  title: string;
  severity: string;
  status: string;
  device: string | null;
  description: string | null;
  resolution: string | null;
  createdBy: string | null;
  createdAt: string;
  resolvedAt: string | null;
  timeline: { id: number; type: string; summary: string; device: string | null; staff: string | null; actor: string | null; at: string }[];
  updates: { key: string; title: string; category: string; severity: string; status: string }[];
  tasks: { id: number; staff: string; group: string; type: string; device: string | null; status: string; startAt: string }[];
  entries: { id: number; staff: string; reason: string; entryAt: string; exitAt: string | null }[];
}

const sevTone = (s: string): Tone => (s === "critical" ? "danger" : s === "high" ? "warning" : s === "medium" ? "info" : "neutral");
const statusTone = (s: string): Tone => (s === "Open" ? "danger" : s === "Investigating" ? "warning" : s === "Resolved" ? "success" : "neutral");

const STEP_LABEL: Record<string, string> = { finding: "Finding", update: "Update", staff: "Staff", task: "Task", action: "Action", resolution: "Resolution", note: "Note" };

export function ServerRoomIncidentsClient({ canManage }: { canManage: boolean }) {
  const toast = useToast();
  const { options } = useServerRoomOptions();

  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [loading, setLoading] = useState(true);
  const [fStatus, setFStatus] = useState("open");
  const [fSeverity, setFSeverity] = useState("");
  const [fQ, setFQ] = useState("");

  // create
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [deviceId, setDeviceId] = useState("");
  const [desc, setDesc] = useState("");
  const [staffName, setStaffName] = useState("");

  // detail
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [resolution, setResolution] = useState("");
  const [stepType, setStepType] = useState("action");
  const [stepText, setStepText] = useState("");
  const [stepStaff, setStepStaff] = useState("");

  async function load(nextPage = page) {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(nextPage), pageSize: String(pageSize) });
      if (fStatus) p.set("status", fStatus);
      if (fSeverity) p.set("severity", fSeverity);
      if (fQ.trim()) p.set("q", fQ.trim());
      const res = await fetch(`/api/admin/server-room/incidents?${p.toString()}`);
      const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string; data?: IncidentRow[]; total?: number };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to load incidents");
      setRows(json.data ?? []);
      setTotal(json.total ?? 0);
      setPage(nextPage);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to load incidents." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openDetail(number: string) {
    setOpen(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/admin/server-room/incidents/${number}`);
      const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string; data?: IncidentDetail };
      if (!res.ok || !json.ok || !json.data) throw new Error(json.error ?? "Failed to load the incident");
      setDetail(json.data);
      setNewStatus(json.data.status);
      setResolution(json.data.resolution ?? "");
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to load the incident." });
      setOpen(false);
    }
  }

  async function create() {
    if (!title.trim()) {
      toast.show({ type: "error", message: "Give the incident a title." });
      return;
    }
    try {
      const json = await postJson("/api/admin/server-room/incidents", "POST", { title: title.trim(), severity, deviceId: deviceId || null, description: desc.trim() || null, staffName: staffName || null });
      toast.show({ type: "success", message: `Incident ${json.number} created.` });
      setTitle("");
      setDesc("");
      setDeviceId("");
      setStaffName("");
      setShowNew(false);
      await load(1);
      await openDetail(String(json.number));
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to create the incident." });
    }
  }

  async function saveStatus() {
    if (!detail) return;
    try {
      await postJson(`/api/admin/server-room/incidents/${detail.number}`, "PATCH", { status: newStatus, resolution: resolution.trim() || null });
      toast.show({ type: "success", message: "Incident updated." });
      await Promise.all([openDetail(detail.number), load(page)]);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to update the incident." });
    }
  }

  async function addStep() {
    if (!detail || !stepText.trim()) return;
    try {
      await postJson(`/api/admin/server-room/incidents/${detail.number}/steps`, "POST", { type: stepType, summary: stepText.trim(), staffName: stepStaff || null });
      setStepText("");
      await openDetail(detail.number);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to add the step." });
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <select style={inputStyle} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="open">Open + investigating</option>
            <option value="">Every status</option>
            {INCIDENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select style={inputStyle} value={fSeverity} onChange={(e) => setFSeverity(e.target.value)}>
            <option value="">Any severity</option>
            {INCIDENT_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input style={inputStyle} placeholder="Incident ID, title or device" value={fQ} onChange={(e) => setFQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(1)} />
          <Button variant="secondary" onClick={() => load(1)} disabled={loading}>
            {loading ? "Loading..." : "Apply filters"}
          </Button>
          {canManage && <Button onClick={() => setShowNew((v) => !v)}>{showNew ? "Cancel" : "New incident"}</Button>}
        </div>
        {showNew && canManage && (
          <div className="flex flex-col gap-2" style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
            <div className="flex flex-wrap gap-3">
              <input style={{ ...inputStyle, minWidth: 320 }} placeholder="Incident title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} />
              <select style={inputStyle} value={severity} onChange={(e) => setSeverity(e.target.value)}>
                {INCIDENT_SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select style={{ ...inputStyle, minWidth: 200 }} value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
                <option value="">Server / device (optional)</option>
                {options.devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
              <select style={inputStyle} value={staffName} onChange={(e) => setStaffName(e.target.value)}>
                <option value="">Reported by (optional)</option>
                {options.staff.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <textarea style={{ ...inputStyle, minHeight: 56, width: "100%" }} placeholder="What was found?" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={2000} />
            <div>
              <Button onClick={create}>Create incident</Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0 }}>{loading ? "Loading..." : "No incidents match."}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  {["Incident ID", "Title", "Severity", "Status", "Server / device", "Opened", "Steps"].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.number} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={() => openDetail(r.number)}>
                    <td style={{ ...td, whiteSpace: "nowrap", fontWeight: 600 }}>{r.number}</td>
                    <td style={td}>{r.title}</td>
                    <td style={td}>
                      <Badge tone={sevTone(r.severity)}>{r.severity}</Badge>
                    </td>
                    <td style={td}>
                      <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                    </td>
                    <td style={td}>{r.device ?? "-"}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", color: "var(--ink-muted)" }}>{formatUtcTimestamp(r.createdAt)}</td>
                    <td style={td}>{r.steps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center gap-3" style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>
          <span>
            Page {page} of {pages} ({total} incidents)
          </span>
          <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => load(page - 1)}>
            Previous
          </Button>
          <Button size="sm" variant="secondary" disabled={page >= pages || loading} onClick={() => load(page + 1)}>
            Next
          </Button>
        </div>
      </Card>

      <SidePanel open={open} onClose={() => setOpen(false)} title={detail ? `${detail.number} - ${detail.title}` : "Incident"} width={720}>
        <div className="flex flex-col gap-4 p-5" style={{ overflowY: "auto" }}>
          {!detail && <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>Loading...</p>}
          {detail && (
            <>
              <div className="flex flex-wrap items-center gap-2" style={{ fontSize: "0.82rem" }}>
                <Badge tone={sevTone(detail.severity)}>{detail.severity}</Badge>
                <Badge tone={statusTone(detail.status)}>{detail.status}</Badge>
                <span style={{ color: "var(--ink-muted)" }}>
                  {detail.device ? `${detail.device} - ` : ""}opened {formatUtcTimestamp(detail.createdAt)}
                  {detail.createdBy ? ` by ${detail.createdBy}` : ""}
                  {detail.resolvedAt ? ` - resolved ${formatUtcTimestamp(detail.resolvedAt)}` : ""}
                </span>
              </div>
              {detail.description && <p style={{ margin: 0, fontSize: "0.85rem" }}>{detail.description}</p>}

              {canManage && (
                <div className="flex flex-col gap-2" style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                  <div className="flex flex-wrap items-center gap-3">
                    <select style={inputStyle} value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                      {INCIDENT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" onClick={saveStatus}>
                      Update status
                    </Button>
                  </div>
                  <textarea style={{ ...inputStyle, minHeight: 52, width: "100%" }} placeholder="Resolution (required to resolve or close)" value={resolution} onChange={(e) => setResolution(e.target.value)} maxLength={2000} />
                </div>
              )}
              {!canManage && detail.resolution && <p style={{ margin: 0, fontSize: "0.85rem" }}>Resolution: {detail.resolution}</p>}

              <div>
                <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.4rem" }}>Timeline: device - finding - update - staff - task - action - resolution</h3>
                <div className="flex flex-col gap-2" style={{ fontSize: "0.82rem" }}>
                  {detail.timeline.map((t) => (
                    <div key={t.id} className="flex flex-wrap items-start gap-2">
                      <span style={{ color: "var(--ink-muted)", whiteSpace: "nowrap" }}>{formatUtcTimestamp(t.at)}</span>
                      <Badge tone={t.type === "resolution" ? "success" : t.type === "finding" ? "danger" : "info"}>{STEP_LABEL[t.type] ?? t.type}</Badge>
                      <span style={{ flex: 1, minWidth: 220 }}>
                        {t.summary}
                        {t.device ? <span style={{ color: "var(--ink-muted)" }}> - {t.device}</span> : null}
                        {t.staff ? <span style={{ color: "var(--ink-muted)" }}> - {t.staff}</span> : null}
                      </span>
                      {t.actor && <span style={{ color: "var(--ink-muted)" }}>by {t.actor}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {canManage && (
                <div className="flex flex-col gap-2" style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                  <h3 style={{ fontSize: "0.95rem", margin: 0 }}>Add a step</h3>
                  <div className="flex flex-wrap gap-3">
                    <select style={inputStyle} value={stepType} onChange={(e) => setStepType(e.target.value)}>
                      {STEP_TYPES.map((s) => (
                        <option key={s} value={s}>
                          {STEP_LABEL[s]}
                        </option>
                      ))}
                    </select>
                    <select style={inputStyle} value={stepStaff} onChange={(e) => setStepStaff(e.target.value)}>
                      <option value="">Staff (optional)</option>
                      {options.staff.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea style={{ ...inputStyle, minHeight: 52, width: "100%" }} placeholder="What happened?" value={stepText} onChange={(e) => setStepText(e.target.value)} maxLength={1000} />
                  <div>
                    <Button size="sm" onClick={addStep}>
                      Add step
                    </Button>
                  </div>
                </div>
              )}

              {(detail.updates.length > 0 || detail.tasks.length > 0 || detail.entries.length > 0) && (
                <div className="flex flex-col gap-2" style={{ fontSize: "0.8rem" }}>
                  {detail.updates.length > 0 && (
                    <div>
                      <strong>Linked updates ({detail.updates.length})</strong>
                      {detail.updates.map((u) => (
                        <div key={u.key} style={{ color: "var(--ink-muted)" }}>
                          {u.title} - {u.category} - {u.status}
                        </div>
                      ))}
                    </div>
                  )}
                  {detail.tasks.length > 0 && (
                    <div>
                      <strong>Linked tasks ({detail.tasks.length})</strong>
                      {detail.tasks.map((t) => (
                        <div key={t.id} style={{ color: "var(--ink-muted)" }}>
                          {t.staff}: {t.type} ({t.group}) - {t.status} - {formatUtcTimestamp(t.startAt)}
                        </div>
                      ))}
                    </div>
                  )}
                  {detail.entries.length > 0 && (
                    <div>
                      <strong>Linked server room visits ({detail.entries.length})</strong>
                      {detail.entries.map((e) => (
                        <div key={e.id} style={{ color: "var(--ink-muted)" }}>
                          {e.staff}: {e.reason} - {formatUtcTimestamp(e.entryAt)}
                          {e.exitAt ? ` to ${formatUtcTimestamp(e.exitAt)}` : " (still inside)"}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </SidePanel>
    </div>
  );
}
