"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SidePanel } from "@/components/ui/SidePanel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { parseJsonResponse } from "@/lib/apiFetch";
import { formatUtcTimestamp } from "@/lib/formatUtcTimestamp";
import { DisruptiveConfirmModal, InstallActivity, ScheduleModal, type DisruptiveItem } from "./InstallControls";
import { inputStyle, categoryTone, severityTone, osLabel, eventTone, EVENT_LABELS, th, td } from "./shared";

interface DeviceRow {
  deviceId: string;
  hostname: string;
  deviceName: string | null;
  deviceType: string;
  os: string | null;
  agentVersion: string | null;
  ip: string | null;
  staffName: string | null;
  online: boolean;
  agentSupportsScan: boolean;
  scannedAt: string | null;
  supported: boolean | null;
  complete: boolean | null;
  rebootRequired: boolean | null;
  pending: number | null;
  security: number | null;
  critical: number | null;
  failed: number | null;
}

interface UpdateRow {
  key: string;
  title: string;
  category: string;
  severity: string;
  currentVersion: string | null;
  newVersion: string | null;
  sizeMB: number | null;
  requiresReboot: boolean;
  isDisruptive: boolean;
  status: string;
  failureMessage: string | null;
  firstSeenAt: string;
  incidentNumber: string | null;
}

interface Details {
  device: DeviceRow;
  scan: {
    scannedAt: string;
    trigger: string;
    family: string | null;
    supported: boolean;
    complete: boolean;
    rebootRequired: boolean;
    pending: number;
    security: number;
    critical: number;
    failed: number;
    lastInstalledAt: string | null;
    definitions: { name: string; version: string; ageDays: number | null } | null;
    warnings: string[];
  } | null;
  updates: UpdateRow[];
  history: { id: number; eventType: string; title: string | null; detail: string | null; actor: string | null; createdAt: string }[];
}

export function SecurityUpdatesDevicesClient({ canScan, canInstall, canSchedule, canIncident, initialStatus }: { canScan: boolean; canInstall: boolean; canSchedule: boolean; canIncident: boolean; initialStatus: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [loading, setLoading] = useState(true);
  const [os, setOs] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState<Details | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [activityKey, setActivityKey] = useState(0);
  const [disruptive, setDisruptive] = useState<{ deviceId: string; hostname: string; keys: string[]; items: DisruptiveItem[] } | null>(null);
  const [safeConfirm, setSafeConfirm] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  async function load(nextPage = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(nextPage), pageSize: String(pageSize) });
      if (os) params.set("os", os);
      if (type) params.set("type", type);
      if (status) params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/admin/security-updates/devices?${params.toString()}`);
      const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string; data?: DeviceRow[]; total?: number };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to load devices");
      setRows(json.data ?? []);
      setTotal(json.total ?? 0);
      setPage(nextPage);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to load devices." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function scan(body: { all: true } | { deviceIds: string[] }) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/security-updates/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string; queued?: number; skipped?: { hostname: string; reason: string }[] };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to queue scans");
      const skipped = json.skipped ?? [];
      toast.show({
        type: skipped.length > 0 && (json.queued ?? 0) === 0 ? "error" : "success",
        message:
          `Scan queued for ${json.queued ?? 0} device(s).` +
          (skipped.length ? ` Skipped ${skipped.length}: ${skipped.slice(0, 3).map((s) => `${s.hostname} (${s.reason})`).join("; ")}${skipped.length > 3 ? "..." : ""}` : " Results appear within a minute or two."),
      });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to queue scans." });
    } finally {
      setBusy(false);
    }
  }

  // Approved install of the chosen updates on one device. Disruptive ones come back as "confirmation required" with the
  // list; the administrator then confirms in a dialog and the request is sent again with confirmDisruptive.
  async function installKeys(deviceId: string, hostname: string, keys: string[], confirmDisruptive: boolean) {
    if (keys.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/security-updates/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, updateKeys: keys, confirmDisruptive }),
      });
      const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string; count?: number; confirmationRequired?: boolean; items?: DisruptiveItem[] };
      if (json.confirmationRequired && json.items && json.items.length > 0) {
        setDisruptive({ deviceId, hostname, keys, items: json.items });
        return;
      }
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Could not queue the install");
      setDisruptive(null);
      setPicked(new Set());
      toast.show({ type: "success", message: `Install approved for ${json.count ?? keys.length} update(s) on ${hostname}. The agent starts it on its next heartbeat.` });
      setActivityKey((k) => k + 1);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Could not queue the install." });
    } finally {
      setBusy(false);
    }
  }

  // "Update" on the selected devices: non-disruptive updates only.
  async function installSafeSelected() {
    setSafeConfirm(false);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/security-updates/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceIds: Array.from(selected), safeOnly: true }),
      });
      const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string; queued?: { hostname: string; count: number }[]; skipped?: { hostname: string; reason: string }[] };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Could not queue the installs");
      const queued = json.queued ?? [];
      const skipped = json.skipped ?? [];
      toast.show({
        type: queued.length === 0 ? "error" : "success",
        message:
          `Install approved on ${queued.length} device(s).` +
          (skipped.length ? ` Skipped ${skipped.length}: ${skipped.slice(0, 3).map((s) => `${s.hostname} (${s.reason})`).join("; ")}${skipped.length > 3 ? "..." : ""}` : ""),
      });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Could not queue the installs." });
    } finally {
      setBusy(false);
    }
  }

  // Quiet refresh (no spinner) after an install finishes, so the pending list and counts update by themselves.
  async function refreshDetails(deviceId: string) {
    try {
      const res = await fetch(`/api/admin/security-updates/devices/${encodeURIComponent(deviceId)}`);
      const json = (await parseJsonResponse(res)) as { ok: boolean; data?: Details };
      if (res.ok && json.ok && json.data) setDetails(json.data);
      await load(page);
    } catch {
      /* the next manual refresh will pick it up */
    }
  }

  async function openDetails(deviceId: string) {
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetails(null);
    setPicked(new Set());
    try {
      const res = await fetch(`/api/admin/security-updates/devices/${encodeURIComponent(deviceId)}`);
      const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string; data?: Details };
      if (!res.ok || !json.ok || !json.data) throw new Error(json.error ?? "Failed to load details");
      setDetails(json.data);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to load details." });
      setDetailsOpen(false);
    } finally {
      setDetailsLoading(false);
    }
  }

  // Raises one incident from this device's failed and critical/security updates: device -> finding -> update.
  async function createIncidentFor(d: Details) {
    const risky = d.updates.filter((u) => u.status === "Failed" || u.category === "critical" || u.category === "security");
    if (risky.length === 0) return;
    try {
      const anyCritical = risky.some((u) => u.category === "critical" || u.severity === "critical");
      const res = await fetch("/api/admin/server-room/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${d.device.deviceName || d.device.hostname}: ${risky.length} failed / critical / security update(s)`,
          severity: anyCritical ? "critical" : "high",
          deviceId: d.device.deviceId,
          updateKeys: risky.map((u) => u.key),
          description: risky.slice(0, 5).map((u) => u.title).join("; "),
        }),
      });
      const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string; number?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to create the incident");
      toast.show({ type: "success", message: `Incident ${json.number} created and linked to ${risky.length} update(s). Manage it under Server Room > Incidents.` });
      await openDetails(d.device.deviceId);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to create the incident." });
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.deviceId));

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <input style={inputStyle} placeholder="Search device, employee or IP" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(1)} />
          <select style={inputStyle} value={os} onChange={(e) => setOs(e.target.value)}>
            <option value="">Any OS</option>
            <option value="windows">Windows</option>
            <option value="linux">Linux</option>
            <option value="darwin">macOS</option>
          </select>
          <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Servers and PCs</option>
            <option value="Server">Servers</option>
            <option value="Workstation">PCs / laptops</option>
          </select>
          <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            <option value="needs">Has pending updates</option>
            <option value="failed">Has failed updates</option>
            <option value="reboot">Restart required</option>
            <option value="clean">Up to date</option>
            <option value="never">Never scanned</option>
          </select>
          <Button variant="secondary" onClick={() => load(1)} disabled={loading}>
            {loading ? "Loading..." : "Apply filters"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canScan && (
            <>
              <Button onClick={() => scan({ all: true })} disabled={busy}>
                Scan All
              </Button>
              <Button variant="secondary" onClick={() => scan({ deviceIds: Array.from(selected) })} disabled={busy || selected.size === 0}>
                Scan Selected ({selected.size})
              </Button>
            </>
          )}
          <Button
            variant="secondary"
            onClick={() => setSafeConfirm(true)}
            disabled={!canInstall || busy || selected.size === 0}
            title={canInstall ? "Install the non-disruptive pending updates on the selected devices" : "You do not have permission to install updates"}
          >
            Update ({selected.size})
          </Button>
          <Button
            variant="secondary"
            onClick={() => setScheduleOpen(true)}
            disabled={!canSchedule || selected.size === 0}
            title={canSchedule ? "Schedule installs for the selected devices" : "You do not have permission to schedule updates"}
          >
            Schedule Update ({selected.size})
          </Button>
          <Link href="/dashboard/security-updates/schedules" style={{ fontSize: "0.82rem", color: "var(--accent)" }}>
            View schedules
          </Link>
          <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>
            Select devices, then Update or Schedule. OS, kernel, firmware, critical and restart-requiring updates always need your explicit confirmation.
          </span>
        </div>
      </Card>

      <Card className="flex flex-col gap-2">
        {loading && rows.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0 }}>Loading...</p>
        ) : rows.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0 }}>No devices match these filters.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={th}>
                    <input
                      type="checkbox"
                      checked={allOnPage}
                      onChange={() => setSelected((prev) => (allOnPage ? new Set([...prev].filter((id) => !rows.some((r) => r.deviceId === id))) : new Set([...prev, ...rows.map((r) => r.deviceId)])))}
                    />
                  </th>
                  {["Device", "OS", "Employee", "Pending", "Security", "Critical", "Failed", "Restart", "Last scan", "Agent"].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.deviceId} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={() => openDetails(r.deviceId)}>
                    <td style={td} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(r.deviceId)} onChange={() => toggle(r.deviceId)} />
                    </td>
                    <td style={td}>
                      <div style={{ fontWeight: 500 }}>{r.deviceName || r.hostname}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>
                        {r.deviceType} - {r.online ? "online" : "offline"}
                      </div>
                    </td>
                    <td style={td}>{osLabel(r.os)}</td>
                    <td style={td}>{r.staffName ?? "-"}</td>
                    {r.scannedAt === null ? (
                      <td style={{ ...td, color: "var(--ink-muted)" }} colSpan={5}>
                        {r.agentSupportsScan ? "Not scanned yet" : "Agent upgrade required for update scans"}
                      </td>
                    ) : r.supported === false ? (
                      <td style={{ ...td, color: "var(--ink-muted)" }} colSpan={5}>
                        Scanning not supported on this system
                      </td>
                    ) : (
                      <>
                        <td style={td}>{r.pending}</td>
                        <td style={td}>{r.security ? <Badge tone="danger">{r.security}</Badge> : 0}</td>
                        <td style={td}>{r.critical ? <Badge tone="danger">{r.critical}</Badge> : 0}</td>
                        <td style={td}>{r.failed ? <Badge tone="warning">{r.failed}</Badge> : 0}</td>
                        <td style={td}>{r.rebootRequired ? <Badge tone="warning">Yes</Badge> : "No"}</td>
                      </>
                    )}
                    <td style={{ ...td, whiteSpace: "nowrap", color: "var(--ink-muted)" }}>
                      {r.scannedAt ? formatUtcTimestamp(r.scannedAt) : "-"}
                      {r.complete === false && <Badge tone="warning">incomplete</Badge>}
                    </td>
                    <td style={{ ...td, color: "var(--ink-muted)" }}>{r.agentVersion ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center gap-3" style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>
          <span>
            Page {page} of {pages} ({total} devices)
          </span>
          <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => load(page - 1)}>
            Previous
          </Button>
          <Button size="sm" variant="secondary" disabled={page >= pages || loading} onClick={() => load(page + 1)}>
            Next
          </Button>
        </div>
      </Card>

      <SidePanel open={detailsOpen} onClose={() => setDetailsOpen(false)} title={details ? `${details.device.deviceName || details.device.hostname} - Updates` : "Updates"} width={760}>
        <div className="flex flex-col gap-4 p-5" style={{ overflowY: "auto" }}>
          {detailsLoading && <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>Loading...</p>}
          {details && (
            <>
              <div className="flex flex-wrap items-center gap-2" style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>
                <span>
                  {osLabel(details.device.os)} ({details.scan?.family ?? "no scan yet"}) - {details.device.online ? "online" : "offline"}
                </span>
                {canScan && (
                  <Button size="sm" onClick={() => scan({ deviceIds: [details.device.deviceId] })} disabled={busy}>
                    Scan this device
                  </Button>
                )}
                {canIncident && details.updates.some((u) => u.status === "Failed" || u.category === "critical" || u.category === "security") && (
                  <Button size="sm" variant="secondary" onClick={() => createIncidentFor(details)}>
                    Create incident from failed / critical updates
                  </Button>
                )}
              </div>

              {details.scan ? (
                <div className="flex flex-col gap-2" style={{ fontSize: "0.85rem" }}>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={details.scan.pending > 0 ? "warning" : "success"}>{details.scan.pending} pending</Badge>
                    <Badge tone={details.scan.security > 0 ? "danger" : "neutral"}>{details.scan.security} security</Badge>
                    <Badge tone={details.scan.critical > 0 ? "danger" : "neutral"}>{details.scan.critical} critical</Badge>
                    <Badge tone={details.scan.failed > 0 ? "warning" : "neutral"}>{details.scan.failed} failed</Badge>
                    <Badge tone={details.scan.rebootRequired ? "warning" : "success"}>{details.scan.rebootRequired ? "Restart required" : "No restart needed"}</Badge>
                    {!details.scan.complete && <Badge tone="warning">Scan incomplete</Badge>}
                  </div>
                  <span style={{ color: "var(--ink-muted)" }}>
                    Scanned {formatUtcTimestamp(details.scan.scannedAt)} ({details.scan.trigger}). Last installed update: {details.scan.lastInstalledAt ? formatUtcTimestamp(details.scan.lastInstalledAt) : "unknown"}.
                    {details.scan.definitions && ` ${details.scan.definitions.name} definitions ${details.scan.definitions.version}${details.scan.definitions.ageDays !== null ? ` (${details.scan.definitions.ageDays} day(s) old)` : ""}.`}
                  </span>
                  {details.scan.warnings.length > 0 && <span style={{ color: "var(--warning)" }}>Notes: {details.scan.warnings.join(" | ")}</span>}
                </div>
              ) : (
                <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0 }}>
                  {details.device.agentSupportsScan ? "This device has not reported an update scan yet." : "This device's agent is too old for update scans - roll out a newer agent version."}
                </p>
              )}

              <div>
                <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.4rem" }}>Pending and failed updates ({details.updates.length})</h3>
                {canInstall && details.updates.some((u) => u.status === "Pending") && (
                  <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: "0.5rem" }}>
                    <Button size="sm" onClick={() => installKeys(details.device.deviceId, details.device.deviceName || details.device.hostname, Array.from(picked), false)} disabled={busy || picked.size === 0 || !details.device.online}>
                      Install selected ({picked.size})
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        installKeys(
                          details.device.deviceId,
                          details.device.deviceName || details.device.hostname,
                          details.updates.filter((u) => u.status === "Pending" && !u.isDisruptive).map((u) => u.key),
                          false
                        )
                      }
                      disabled={busy || !details.device.online || !details.updates.some((u) => u.status === "Pending" && !u.isDisruptive)}
                    >
                      Install all safe updates
                    </Button>
                    {!details.device.online && <span style={{ fontSize: "0.78rem", color: "var(--warning)" }}>Device is offline - installs can only be queued while it reports in.</span>}
                  </div>
                )}
                {details.updates.length === 0 ? (
                  <p style={{ fontSize: "0.82rem", color: "var(--ink-muted)", margin: 0 }}>Nothing pending.</p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                      <thead>
                        <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                          {canInstall && <th style={th} />}
                          {["Update", "Type", "Severity", "Version", "Size", "Notes"].map((h) => (
                            <th key={h} style={th}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {details.updates.map((u) => (
                          <tr key={u.key} style={{ borderBottom: "1px solid var(--border)", verticalAlign: "top" }}>
                            {canInstall && (
                              <td style={td}>
                                {u.status === "Pending" && (
                                  <input
                                    type="checkbox"
                                    checked={picked.has(u.key)}
                                    onChange={() =>
                                      setPicked((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(u.key)) next.delete(u.key);
                                        else next.add(u.key);
                                        return next;
                                      })
                                    }
                                  />
                                )}
                              </td>
                            )}
                            <td style={td}>
                              {u.title}
                              {u.status === "Failed" && u.failureMessage && <div style={{ color: "var(--danger)", fontSize: "0.74rem" }}>{u.failureMessage}</div>}
                            </td>
                            <td style={td}>{u.status === "Failed" ? <Badge tone="danger">failed</Badge> : <Badge tone={categoryTone(u.category)}>{u.category}</Badge>}</td>
                            <td style={td}>{u.severity !== "none" ? <Badge tone={severityTone(u.severity)}>{u.severity}</Badge> : "-"}</td>
                            <td style={{ ...td, color: "var(--ink-muted)" }}>{[u.currentVersion, u.newVersion].filter(Boolean).join(" -> ") || "-"}</td>
                            <td style={{ ...td, color: "var(--ink-muted)" }}>{u.sizeMB ? `${u.sizeMB} MB` : "-"}</td>
                            <td style={td}>
                              {u.requiresReboot && <Badge tone="warning">restart</Badge>} {u.isDisruptive && <Badge tone="neutral">needs confirmation</Badge>} {u.incidentNumber && <Badge tone="info">{u.incidentNumber}</Badge>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <InstallActivity deviceId={details.device.deviceId} refreshKey={activityKey} onSettled={() => refreshDetails(details.device.deviceId)} />

              <div>
                <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.4rem" }}>Recent history</h3>
                <div className="flex flex-col gap-1" style={{ fontSize: "0.8rem" }}>
                  {details.history.length === 0 && <span style={{ color: "var(--ink-muted)" }}>No events yet.</span>}
                  {details.history.map((h) => (
                    <div key={h.id} className="flex flex-wrap items-center gap-2">
                      <span style={{ color: "var(--ink-muted)", whiteSpace: "nowrap" }}>{formatUtcTimestamp(h.createdAt)}</span>
                      <Badge tone={eventTone(h.eventType)}>{EVENT_LABELS[h.eventType] ?? h.eventType}</Badge>
                      <span>{h.title ? `${h.title}${h.detail ? ` - ${h.detail}` : ""}` : h.detail}</span>
                      {h.actor && <span style={{ color: "var(--ink-muted)" }}>by {h.actor}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </SidePanel>

      <ConfirmDialog
        open={safeConfirm}
        onClose={() => setSafeConfirm(false)}
        onConfirm={installSafeSelected}
        title="Install safe updates"
        message={`Install the pending non-disruptive updates on ${selected.size} selected device(s)? OS, kernel, firmware, critical and restart-requiring updates are NOT included, and no device is restarted.`}
        confirmLabel="Install"
        tone="primary"
        loading={busy}
      />
      <ScheduleModal open={scheduleOpen} deviceIds={Array.from(selected)} onClose={() => setScheduleOpen(false)} onCreated={() => undefined} />
      <DisruptiveConfirmModal
        open={disruptive !== null}
        hostname={disruptive?.hostname ?? ""}
        items={disruptive?.items ?? []}
        busy={busy}
        onCancel={() => setDisruptive(null)}
        onConfirm={() => disruptive && installKeys(disruptive.deviceId, disruptive.hostname, disruptive.keys, true)}
      />
    </div>
  );
}
