"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { parseJsonResponse } from "@/lib/apiFetch";
import { formatUtcTimestamp } from "@/lib/formatUtcTimestamp";
import { th, td } from "./shared";

interface ScheduleRow {
  id: number;
  name: string;
  recurrence: string;
  nextRunAt: string | null;
  categories: string[];
  includeDisruptive: boolean;
  confirmedBy: string | null;
  isActive: boolean;
  lastRunAt: string | null;
  lastRunSummary: string | null;
  createdBy: string | null;
  deviceCount: number;
  devices: string | null;
}

export function SecurityUpdatesSchedulesClient({ canSchedule }: { canSchedule: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<ScheduleRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/security-updates/schedules");
      const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string; data?: ScheduleRow[] };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to load schedules");
      setRows(json.data ?? []);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to load schedules." });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setActive(r: ScheduleRow, isActive: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/security-updates/schedules/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) });
      const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed");
      await load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to update the schedule." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(r: ScheduleRow) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/security-updates/schedules/${r.id}`, { method: "DELETE" });
      const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed");
      setDeleting(null);
      await load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to delete the schedule." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <p style={{ fontSize: "0.82rem", color: "var(--ink-muted)", margin: 0 }}>
        Create schedules from Devices &amp; Scans: select devices and click Schedule Update. Times are shown in your local time zone; devices must be online at run time.
      </p>
      {loading && rows.length === 0 ? (
        <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0 }}>Loading...</p>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0 }}>No schedules yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                {["Name", "Devices", "Types", "When", "Last run", "Status", ""].map((h) => (
                  <th key={h} style={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border)", verticalAlign: "top" }}>
                  <td style={td}>
                    <div style={{ fontWeight: 500 }}>{r.name}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>by {r.createdBy ?? "unknown"}</div>
                  </td>
                  <td style={td}>
                    {r.deviceCount}
                    <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>
                      {r.devices}
                      {r.deviceCount > 5 ? "..." : ""}
                    </div>
                  </td>
                  <td style={td}>
                    {r.categories.join(", ")}
                    {r.includeDisruptive && (
                      <div>
                        <Badge tone="warning">disruptive confirmed{r.confirmedBy ? ` by ${r.confirmedBy}` : ""}</Badge>
                      </div>
                    )}
                  </td>
                  <td style={td}>
                    {r.nextRunAt ? formatUtcTimestamp(r.nextRunAt) : "-"}
                    <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>{r.recurrence === "weekly" ? "weekly" : "once"}</div>
                  </td>
                  <td style={td}>
                    {r.lastRunAt ? formatUtcTimestamp(r.lastRunAt) : "-"}
                    {r.lastRunSummary && <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>{r.lastRunSummary}</div>}
                  </td>
                  <td style={td}>{r.isActive ? <Badge tone="success">active</Badge> : <Badge tone="neutral">{r.lastRunAt && r.recurrence === "once" ? "finished" : "paused"}</Badge>}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    {canSchedule && (
                      <div className="flex gap-2">
                        {(r.isActive || r.nextRunAt) && (
                          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setActive(r, !r.isActive)}>
                            {r.isActive ? "Pause" : "Resume"}
                          </Button>
                        )}
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => setDeleting(r)}>
                          Delete
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove(deleting)}
        title="Delete schedule"
        message={`Delete "${deleting?.name ?? ""}"? Updates already queued are not cancelled.`}
        confirmLabel="Delete"
        loading={busy}
      />
    </Card>
  );
}
