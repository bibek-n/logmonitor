"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { parseJsonResponse } from "@/lib/apiFetch";
import { formatUtcTimestamp } from "@/lib/formatUtcTimestamp";
import { inputStyle, osLabel, th, td, type Tone } from "@/components/securityUpdates/shared";

interface AuditRow {
  source: string;
  id: number;
  eventType: string;
  at: string;
  staff: string | null;
  actor: string | null;
  device: string | null;
  os: string | null;
  taskType: string | null;
  incidentNumber: string | null;
  detail: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export const AUDIT_EVENT_LABELS: Record<string, string> = {
  server_room_entry: "Server room entry",
  server_room_exit: "Server room exit",
  server_room_entry_updated: "Entry updated",
  task_started: "Task started",
  task_completed: "Task completed",
  task_status_changed: "Task status changed",
  incident_created: "Incident created",
  incident_status_changed: "Incident status changed",
  incident_activity: "Incident activity",
  scan_requested: "Update scan requested",
  scan_completed: "Update scan completed",
  update_found: "Update found",
  update_failed: "Update failed",
  update_installed: "Update installed / cleared",
  reboot_required: "Restart required",
  incident_linked: "Update linked to incident",
  install_requested: "Update install approved",
  install_started: "Update install started",
  install_completed: "Update install finished",
  update_install_failed: "Update install failed",
  update_install_refused: "Update install refused",
  update_install_skipped: "Update install skipped",
  schedule_created: "Update schedule created",
  schedule_run: "Update schedule ran",
};

function eventTone(e: string): Tone {
  if (e.includes("failed")) return "danger";
  if (e.startsWith("incident")) return "warning";
  if (e === "task_completed" || e === "update_installed" || e === "server_room_exit" || e === "install_completed") return "success";
  if (e === "update_install_refused") return "warning";
  if (e.startsWith("server_room") || e.startsWith("task")) return "info";
  return "neutral";
}

export function ServerRoomAuditClient({ canExport }: { canExport: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [staff, setStaff] = useState("");
  const [device, setDevice] = useState("");
  const [taskType, setTaskType] = useState("");
  const [os, setOs] = useState("");
  const [incident, setIncident] = useState("");
  const [q, setQ] = useState("");

  function filterParams(): URLSearchParams {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (staff.trim()) p.set("staff", staff.trim());
    if (device.trim()) p.set("device", device.trim());
    if (taskType.trim()) p.set("taskType", taskType.trim());
    if (os) p.set("os", os);
    if (incident.trim()) p.set("incident", incident.trim());
    if (q.trim()) p.set("q", q.trim());
    return p;
  }

  async function load(nextPage = page) {
    setLoading(true);
    try {
      const p = filterParams();
      p.set("page", String(nextPage));
      p.set("pageSize", String(pageSize));
      const res = await fetch(`/api/admin/server-room/audit?${p.toString()}`);
      const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string; data?: AuditRow[]; total?: number };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to load the audit history");
      setRows(json.data ?? []);
      setTotal(json.total ?? 0);
      setPage(nextPage);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to load the audit history." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
            From <input style={{ ...inputStyle, marginLeft: 4 }} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
            To <input style={{ ...inputStyle, marginLeft: 4 }} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <input style={inputStyle} placeholder="Staff name" value={staff} onChange={(e) => setStaff(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(1)} />
          <input style={inputStyle} placeholder="Server / device" value={device} onChange={(e) => setDevice(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(1)} />
          <input style={inputStyle} placeholder="Task type" value={taskType} onChange={(e) => setTaskType(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(1)} />
          <select style={inputStyle} value={os} onChange={(e) => setOs(e.target.value)}>
            <option value="">Any OS</option>
            <option value="windows">Windows</option>
            <option value="linux">Linux</option>
            <option value="darwin">macOS</option>
          </select>
          <input style={inputStyle} placeholder="Incident ID" value={incident} onChange={(e) => setIncident(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(1)} />
          <input style={inputStyle} placeholder="Search text" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(1)} />
          <Button onClick={() => load(1)} disabled={loading}>
            {loading ? "Loading..." : "Apply filters"}
          </Button>
          {canExport && (
            <a href={`/api/admin/server-room/audit/export?${filterParams().toString()}`} style={{ textDecoration: "none" }}>
              <Button variant="secondary" type="button">
                Export CSV
              </Button>
            </a>
          )}
        </div>
      </Card>

      <Card className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0 }}>{loading ? "Loading..." : "No audit events match."}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  {["Time", "Event", "Staff / by", "Server / device", "OS", "Task type", "Detail", "Incident", "Completed"].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.source}-${r.id}`} style={{ borderBottom: "1px solid var(--border)", verticalAlign: "top" }}>
                    <td style={{ ...td, whiteSpace: "nowrap", color: "var(--ink-muted)" }}>{formatUtcTimestamp(r.at)}</td>
                    <td style={td}>
                      <Badge tone={eventTone(r.eventType)}>{AUDIT_EVENT_LABELS[r.eventType] ?? r.eventType}</Badge>
                    </td>
                    <td style={td}>
                      {r.staff ?? r.actor ?? "-"}
                      {r.staff && r.actor && r.staff !== r.actor ? <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>by {r.actor}</div> : null}
                    </td>
                    <td style={td}>{r.device ?? "-"}</td>
                    <td style={td}>{r.os ? osLabel(r.os) : "-"}</td>
                    <td style={td}>{r.taskType ?? "-"}</td>
                    <td style={{ ...td, color: "var(--ink-muted)", maxWidth: 360 }}>{r.detail ?? ""}</td>
                    <td style={td}>{r.incidentNumber ?? "-"}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", color: "var(--ink-muted)" }}>{r.completedAt ? formatUtcTimestamp(r.completedAt) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center gap-3" style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>
          <span>
            Page {page} of {pages} ({total} events)
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
