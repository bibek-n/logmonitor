"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { parseJsonResponse } from "@/lib/apiFetch";
import { formatUtcTimestamp } from "@/lib/formatUtcTimestamp";
import { ENTRY_REASONS } from "@/lib/serverRoom/constants";
import { inputStyle, th, td } from "@/components/securityUpdates/shared";
import { postJson, useServerRoomOptions } from "./useOptions";

interface EntryRow {
  id: number;
  staffName: string;
  entryAt: string;
  exitAt: string | null;
  active: boolean;
  reason: string;
  workPerformed: string | null;
  incidentNumber: string | null;
  recordedBy: string | null;
  minutes: number;
  taskCount: number;
}

function duration(min: number): string {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

export function ServerRoomEntriesClient({ canRecord }: { canRecord: boolean }) {
  const toast = useToast();
  const { options, error: optionsError, reload: reloadOptions } = useServerRoomOptions();

  // form
  const [staffId, setStaffId] = useState("");
  const [reason, setReason] = useState("");
  const [work, setWork] = useState("");
  const [incident, setIncident] = useState("");
  const [saving, setSaving] = useState(false);

  // active visitors: work-performed drafts per entry id
  const [exitWork, setExitWork] = useState<Record<number, string>>({});
  const [active, setActive] = useState<EntryRow[]>([]);

  // history
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [staffQ, setStaffQ] = useState("");
  const [reasonQ, setReasonQ] = useState("");
  const [status, setStatus] = useState("");
  const [incidentQ, setIncidentQ] = useState("");

  async function fetchEntries(params: URLSearchParams): Promise<{ data: EntryRow[]; total: number }> {
    const res = await fetch(`/api/admin/server-room/entries?${params.toString()}`);
    const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string; data?: EntryRow[]; total?: number };
    if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to load entries");
    return { data: json.data ?? [], total: json.total ?? 0 };
  }

  async function load(nextPage = page) {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(nextPage), pageSize: String(pageSize) });
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      if (staffQ.trim()) p.set("staff", staffQ.trim());
      if (reasonQ) p.set("reason", reasonQ);
      if (status) p.set("status", status);
      if (incidentQ.trim()) p.set("incident", incidentQ.trim());
      const [list, act] = await Promise.all([fetchEntries(p), fetchEntries(new URLSearchParams({ status: "active", pageSize: "100" }))]);
      setRows(list.data);
      setTotal(list.total);
      setActive(act.data);
      setPage(nextPage);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to load entries." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function record() {
    if (!staffId || !reason) {
      toast.show({ type: "error", message: "Choose the staff member and the reason." });
      return;
    }
    setSaving(true);
    try {
      await postJson("/api/admin/server-room/entries", "POST", {
        staffId: Number(staffId),
        reason,
        workPerformed: work.trim() || null,
        incidentNumber: incident.trim() || null,
      });
      toast.show({ type: "success", message: "Entry recorded. The entry time was set automatically." });
      setStaffId("");
      setReason("");
      setWork("");
      setIncident("");
      await Promise.all([load(1), reloadOptions()]);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to record the entry." });
    } finally {
      setSaving(false);
    }
  }

  async function recordExit(e: EntryRow) {
    try {
      const w = (exitWork[e.id] ?? e.workPerformed ?? "").trim();
      if (!w) {
        toast.show({ type: "error", message: "Write the work performed before recording the exit." });
        return;
      }
      await postJson(`/api/admin/server-room/entries/${e.id}`, "PATCH", { action: "exit", workPerformed: w });
      toast.show({ type: "success", message: `${e.staffName} has left - exit time recorded automatically.` });
      await Promise.all([load(page), reloadOptions()]);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to record the exit." });
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-4">
      {canRecord && (
        <Card className="flex flex-col gap-3">
          <h2 style={{ fontSize: "1rem", margin: 0 }}>Record server room entry</h2>
          <div className="flex flex-wrap gap-3">
            <select style={{ ...inputStyle, minWidth: 220 }} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Staff name...</option>
              {options.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select style={{ ...inputStyle, minWidth: 220 }} value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Reason / task...</option>
              {ENTRY_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input style={inputStyle} placeholder="Incident ID (optional)" value={incident} onChange={(e) => setIncident(e.target.value)} />
          </div>
          <textarea style={{ ...inputStyle, minHeight: 64, width: "100%" }} placeholder="Work performed (you can add or change this when recording the exit)" value={work} onChange={(e) => setWork(e.target.value)} maxLength={2000} />
          <div className="flex items-center gap-3">
            <Button onClick={record} disabled={saving}>
              {saving ? "Recording..." : "Record entry"}
            </Button>
            <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>Entry and exit date &amp; time are recorded automatically by the server.</span>
          </div>
          {optionsError && <span style={{ color: "var(--danger)", fontSize: "0.8rem" }}>{optionsError}</span>}
        </Card>
      )}

      <Card className="flex flex-col gap-2">
        <h2 style={{ fontSize: "1rem", margin: 0 }}>Inside the server room now ({active.length})</h2>
        {active.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0 }}>Nobody is recorded as inside.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {active.map((e) => (
              <div key={e.id} className="flex flex-wrap items-start gap-3" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                <div style={{ minWidth: 220 }}>
                  <div style={{ fontWeight: 600 }}>{e.staffName}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>
                    since {formatUtcTimestamp(e.entryAt)} ({duration(e.minutes)}) - {e.reason}
                  </div>
                </div>
                {canRecord && (
                  <>
                    <textarea
                      style={{ ...inputStyle, flex: 1, minWidth: 260, minHeight: 48 }}
                      placeholder="Work performed"
                      value={exitWork[e.id] ?? e.workPerformed ?? ""}
                      onChange={(ev) => setExitWork((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                      maxLength={2000}
                    />
                    <Button variant="secondary" onClick={() => recordExit(e)}>
                      Record exit
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 style={{ fontSize: "1rem", margin: 0 }}>Entry history</h2>
        <div className="flex flex-wrap gap-3">
          <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
            From <input style={{ ...inputStyle, marginLeft: 4 }} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
            To <input style={{ ...inputStyle, marginLeft: 4 }} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <input style={inputStyle} placeholder="Staff name" value={staffQ} onChange={(e) => setStaffQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(1)} />
          <select style={inputStyle} value={reasonQ} onChange={(e) => setReasonQ(e.target.value)}>
            <option value="">Any reason</option>
            {ENTRY_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Active and completed</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
          <input style={inputStyle} placeholder="Incident ID" value={incidentQ} onChange={(e) => setIncidentQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(1)} />
          <Button variant="secondary" onClick={() => load(1)} disabled={loading}>
            {loading ? "Loading..." : "Apply filters"}
          </Button>
        </div>
        {rows.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0 }}>{loading ? "Loading..." : "No entries match."}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  {["Staff", "Entry", "Exit", "Time inside", "Reason", "Work performed", "Tasks", "Incident", "Status"].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border)", verticalAlign: "top" }}>
                    <td style={td}>{r.staffName}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{formatUtcTimestamp(r.entryAt)}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{r.exitAt ? formatUtcTimestamp(r.exitAt) : "-"}</td>
                    <td style={td}>{duration(r.minutes)}</td>
                    <td style={td}>{r.reason}</td>
                    <td style={{ ...td, color: "var(--ink-muted)", maxWidth: 360 }}>{r.workPerformed ?? ""}</td>
                    <td style={td}>{r.taskCount}</td>
                    <td style={td}>{r.incidentNumber ?? "-"}</td>
                    <td style={td}>{r.active ? <Badge tone="warning">Inside</Badge> : <Badge tone="success">Completed</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center gap-3" style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>
          <span>
            Page {page} of {pages} ({total} entries)
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
