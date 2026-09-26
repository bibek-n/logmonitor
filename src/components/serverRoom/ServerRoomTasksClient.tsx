"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { parseJsonResponse } from "@/lib/apiFetch";
import { formatUtcTimestamp } from "@/lib/formatUtcTimestamp";
import { TASK_GROUPS, TASK_STATUSES, TASK_TYPES, type TaskGroup } from "@/lib/serverRoom/constants";
import { inputStyle, osLabel, th, td, type Tone } from "@/components/securityUpdates/shared";
import { postJson, useServerRoomOptions } from "./useOptions";

interface TaskRow {
  id: number;
  entryId: number | null;
  staffName: string;
  group: string;
  type: string;
  deviceId: string | null;
  device: string | null;
  os: string | null;
  description: string;
  startAt: string;
  endAt: string | null;
  status: string;
  incidentNumber: string | null;
}

function statusTone(s: string): Tone {
  return s === "Completed" ? "success" : s === "Blocked" ? "danger" : s === "Cancelled" ? "neutral" : "warning";
}

export function ServerRoomTasksClient({ canRecord, canIncident }: { canRecord: boolean; canIncident: boolean }) {
  const toast = useToast();
  const { options, error: optionsError } = useServerRoomOptions();

  // form
  const [staffId, setStaffId] = useState("");
  const [group, setGroup] = useState<TaskGroup>("Technical Support");
  const [type, setType] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [entryId, setEntryId] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("In Progress");
  const [incident, setIncident] = useState("");
  const [saving, setSaving] = useState(false);

  // list
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [loading, setLoading] = useState(true);
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fStaff, setFStaff] = useState("");
  const [fGroup, setFGroup] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fDevice, setFDevice] = useState("");
  const [fIncident, setFIncident] = useState("");

  async function load(nextPage = page) {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(nextPage), pageSize: String(pageSize) });
      if (fFrom) p.set("from", fFrom);
      if (fTo) p.set("to", fTo);
      if (fStaff.trim()) p.set("staff", fStaff.trim());
      if (fGroup) p.set("group", fGroup);
      if (fStatus) p.set("status", fStatus);
      if (fDevice.trim()) p.set("device", fDevice.trim());
      if (fIncident.trim()) p.set("incident", fIncident.trim());
      const res = await fetch(`/api/admin/server-room/tasks?${p.toString()}`);
      const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string; data?: TaskRow[]; total?: number };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to load tasks");
      setRows(json.data ?? []);
      setTotal(json.total ?? 0);
      setPage(nextPage);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to load tasks." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setType("");
  }, [group]);

  const staffEntries = options.activeEntries.filter((a) => staffId !== "" && a.staffId === Number(staffId));

  async function save() {
    if (!staffId || !type || !description.trim()) {
      toast.show({ type: "error", message: "Choose the staff member, the task type and describe the work." });
      return;
    }
    setSaving(true);
    try {
      await postJson("/api/admin/server-room/tasks", "POST", {
        staffId: Number(staffId),
        group,
        type,
        deviceId: deviceId || null,
        deviceLabel: deviceId ? null : deviceLabel.trim() || null,
        entryId: entryId ? Number(entryId) : null,
        description: description.trim(),
        status,
        incidentNumber: incident.trim() || null,
      });
      toast.show({ type: "success", message: "Task recorded. Start time was set automatically." });
      setType("");
      setDescription("");
      setIncident("");
      setStatus("In Progress");
      await load(1);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to record the task." });
    } finally {
      setSaving(false);
    }
  }

  async function newIncident() {
    if (!description.trim()) {
      toast.show({ type: "error", message: "Describe the work first - it becomes the incident title." });
      return;
    }
    try {
      const staffName = options.staff.find((s) => s.id === Number(staffId))?.name ?? null;
      const json = await postJson("/api/admin/server-room/incidents", "POST", {
        title: description.trim().slice(0, 120),
        severity: group === "Security Update" ? "high" : "medium",
        deviceId: deviceId || null,
        description: description.trim(),
        staffName,
      });
      setIncident(String(json.number));
      toast.show({ type: "success", message: `Incident ${json.number} created and filled in below.` });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to create the incident." });
    }
  }

  async function setTaskStatus(t: TaskRow, next: string) {
    try {
      await postJson(`/api/admin/server-room/tasks/${t.id}`, "PATCH", { status: next });
      toast.show({ type: "success", message: next === "Completed" ? "Task completed - end time recorded automatically." : `Task marked ${next}.` });
      await load(page);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to update the task." });
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-4">
      {canRecord && (
        <Card className="flex flex-col gap-3">
          <h2 style={{ fontSize: "1rem", margin: 0 }}>Record a task</h2>
          <div className="flex flex-wrap gap-3">
            <select style={{ ...inputStyle, minWidth: 200 }} value={staffId} onChange={(e) => { setStaffId(e.target.value); setEntryId(""); }}>
              <option value="">Staff name...</option>
              {options.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select style={inputStyle} value={group} onChange={(e) => setGroup(e.target.value as TaskGroup)}>
              {TASK_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <select style={{ ...inputStyle, minWidth: 230 }} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Task type...</option>
              {TASK_TYPES[group].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select style={{ ...inputStyle, minWidth: 200 }} value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
              <option value="">Server / device (optional)...</option>
              {options.devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label} ({d.type === "Server" ? "server" : "PC"}, {osLabel(d.os)})
                </option>
              ))}
            </select>
            {!deviceId && <input style={inputStyle} placeholder="...or type a device / system name" value={deviceLabel} onChange={(e) => setDeviceLabel(e.target.value)} />}
          </div>
          <textarea style={{ ...inputStyle, minHeight: 64, width: "100%" }} placeholder="Work description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
          <div className="flex flex-wrap items-center gap-3">
            {staffEntries.length > 0 && (
              <select style={inputStyle} value={entryId} onChange={(e) => setEntryId(e.target.value)}>
                <option value="">Link to current server room visit (optional)</option>
                {staffEntries.map((a) => (
                  <option key={a.id} value={a.id}>
                    Visit #{a.id} - {a.staffName}
                  </option>
                ))}
              </select>
            )}
            <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input style={inputStyle} placeholder="Incident ID (INC-2026-000001)" value={incident} onChange={(e) => setIncident(e.target.value)} />
            {canIncident && (
              <Button variant="secondary" type="button" onClick={newIncident}>
                New incident from this task
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Record task"}
            </Button>
            <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>Start and end times are set automatically (end when you complete it).</span>
          </div>
          {optionsError && <span style={{ color: "var(--danger)", fontSize: "0.8rem" }}>{optionsError}</span>}
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <h2 style={{ fontSize: "1rem", margin: 0 }}>Technical support, hosting and security tasks</h2>
        <div className="flex flex-wrap gap-3">
          <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
            From <input style={{ ...inputStyle, marginLeft: 4 }} type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
          </label>
          <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
            To <input style={{ ...inputStyle, marginLeft: 4 }} type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
          </label>
          <input style={inputStyle} placeholder="Staff name" value={fStaff} onChange={(e) => setFStaff(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(1)} />
          <select style={inputStyle} value={fGroup} onChange={(e) => setFGroup(e.target.value)}>
            <option value="">Any group</option>
            {TASK_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select style={inputStyle} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">Any status</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input style={inputStyle} placeholder="Server / device" value={fDevice} onChange={(e) => setFDevice(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(1)} />
          <input style={inputStyle} placeholder="Incident ID" value={fIncident} onChange={(e) => setFIncident(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(1)} />
          <Button variant="secondary" onClick={() => load(1)} disabled={loading}>
            {loading ? "Loading..." : "Apply filters"}
          </Button>
        </div>
        {rows.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0 }}>{loading ? "Loading..." : "No tasks match."}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  {["Staff", "Group / type", "Server / device", "Work", "Start", "End", "Status", "Incident", ""].map((h, i) => (
                    <th key={i} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border)", verticalAlign: "top" }}>
                    <td style={td}>{r.staffName}</td>
                    <td style={td}>
                      <div>{r.type}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>{r.group}</div>
                    </td>
                    <td style={td}>{r.device ?? "-"}{r.os ? <span style={{ color: "var(--ink-muted)" }}> ({osLabel(r.os)})</span> : null}</td>
                    <td style={{ ...td, maxWidth: 340, color: "var(--ink-muted)" }}>{r.description}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{formatUtcTimestamp(r.startAt)}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{r.endAt ? formatUtcTimestamp(r.endAt) : "-"}</td>
                    <td style={td}>
                      <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                    </td>
                    <td style={td}>{r.incidentNumber ?? "-"}</td>
                    <td style={td}>
                      {canRecord && (r.status === "In Progress" || r.status === "Blocked") && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => setTaskStatus(r, "Completed")}>
                            Complete
                          </Button>
                          {r.status === "In Progress" && (
                            <Button size="sm" variant="secondary" onClick={() => setTaskStatus(r, "Blocked")}>
                              Blocked
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center gap-3" style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>
          <span>
            Page {page} of {pages} ({total} tasks)
          </span>
          <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => load(page - 1)}>
            Previous
          </Button>
          <Button size="sm" variant="secondary" disabled={page >= pages || loading} onClick={() => load(page + 1)}>
            Next
          </Button>
        </div>
      </Card>
    </div>
  );
}
