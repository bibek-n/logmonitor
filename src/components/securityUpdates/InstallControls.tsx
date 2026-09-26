"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { parseJsonResponse } from "@/lib/apiFetch";
import { formatUtcTimestamp } from "@/lib/formatUtcTimestamp";
import { inputStyle, categoryTone, type Tone } from "./shared";

// Phase 3 building blocks: the disruptive-update confirmation, the schedule form and the install activity list.

export interface DisruptiveItem {
  key: string;
  title: string;
  category: string;
}

// Shown before ANY disruptive update (OS, kernel, firmware, critical, restart-requiring) is queued. The agent never
// restarts the machine by itself - a restart afterwards stays a separate, deliberate action.
export function DisruptiveConfirmModal({
  open,
  hostname,
  items,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  hostname: string;
  items: DisruptiveItem[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [ack, setAck] = useState(false);
  useEffect(() => {
    if (open) setAck(false);
  }, [open]);
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Confirm disruptive updates"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!ack || busy}>
            {busy ? "Queuing..." : "Install on device"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" style={{ fontSize: "0.85rem" }}>
        <p style={{ margin: 0 }}>
          <strong>{hostname}</strong> will install {items.length} update(s) that can interrupt work, change the operating system or need a restart:
        </p>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", maxHeight: 180, overflowY: "auto" }}>
          {items.map((i) => (
            <li key={i.key}>
              {i.title} <Badge tone={categoryTone(i.category)}>{i.category}</Badge>
            </li>
          ))}
        </ul>
        <p style={{ margin: 0, color: "var(--ink-muted)" }}>The agent does not restart the computer. If a restart is needed it will be reported, and you decide when to do it.</p>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />I confirm these disruptive updates on this device
        </label>
      </div>
    </Modal>
  );
}

const SAFE_TYPES: { key: string; label: string }[] = [
  { key: "security", label: "Security updates" },
  { key: "application", label: "Application updates" },
  { key: "package", label: "Packages" },
  { key: "definition", label: "Definitions (antivirus)" },
];
const DISRUPTIVE_TYPES: { key: string; label: string }[] = [
  { key: "critical", label: "Critical" },
  { key: "os", label: "Operating system" },
  { key: "kernel", label: "Kernel" },
  { key: "firmware", label: "Firmware / BIOS" },
  { key: "driver", label: "Drivers" },
];

function defaultRunAt(): string {
  // Tomorrow 22:00 local, formatted for <input type="datetime-local">.
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(22, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleModal({ open, deviceIds, onClose, onCreated }: { open: boolean; deviceIds: string[]; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [recurrence, setRecurrence] = useState<"once" | "weekly">("once");
  const [runAt, setRunAt] = useState(defaultRunAt());
  const [types, setTypes] = useState<Set<string>>(new Set(SAFE_TYPES.map((t) => t.key)));
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setRecurrence("once");
      setRunAt(defaultRunAt());
      setTypes(new Set(SAFE_TYPES.map((t) => t.key)));
      setConfirm(false);
    }
  }, [open]);

  function toggleType(key: string) {
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const disruptiveChosen = DISRUPTIVE_TYPES.some((t) => types.has(t.key));

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/security-updates/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          deviceIds,
          categories: Array.from(types),
          includeDisruptive: disruptiveChosen,
          confirmDisruptive: disruptiveChosen && confirm,
          recurrence,
          runAt: new Date(runAt).toISOString(),
        }),
      });
      const json = (await parseJsonResponse(res)) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Could not create the schedule");
      toast.show({ type: "success", message: `Schedule created for ${deviceIds.length} device(s).` });
      onCreated();
      onClose();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Could not create the schedule." });
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = name.trim().length > 0 && types.size > 0 && !!runAt && deviceIds.length > 0 && (!disruptiveChosen || confirm);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule update"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit || busy}>
            {busy ? "Saving..." : "Create schedule"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" style={{ fontSize: "0.85rem" }}>
        <span style={{ color: "var(--ink-muted)" }}>
          {deviceIds.length} device(s) selected. At the scheduled time each device is asked to install its matching pending updates (only while it is online).
        </span>
        <input style={inputStyle} placeholder="Schedule name (e.g. Friday night patching)" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
        <div className="flex flex-wrap gap-3">
          <select style={inputStyle} value={recurrence} onChange={(e) => setRecurrence(e.target.value as "once" | "weekly")}>
            <option value="once">Run once</option>
            <option value="weekly">Repeat weekly</option>
          </select>
          <input style={inputStyle} type="datetime-local" value={runAt} onChange={(e) => setRunAt(e.target.value)} />
        </div>
        <div>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>Update types</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {SAFE_TYPES.map((t) => (
              <label key={t.key} className="flex items-center gap-1">
                <input type="checkbox" checked={types.has(t.key)} onChange={() => toggleType(t.key)} />
                {t.label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>Disruptive types (need confirmation)</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {DISRUPTIVE_TYPES.map((t) => (
              <label key={t.key} className="flex items-center gap-1">
                <input type="checkbox" checked={types.has(t.key)} onChange={() => toggleType(t.key)} />
                {t.label}
              </label>
            ))}
          </div>
        </div>
        {disruptiveChosen && (
          <label className="flex items-center gap-2" style={{ color: "var(--warning)" }}>
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />I confirm disruptive updates for this window (recorded with my name)
          </label>
        )}
        {!disruptiveChosen && <span style={{ color: "var(--ink-muted)" }}>OS, kernel, firmware, critical and restart-requiring updates are skipped unless you tick a disruptive type and confirm.</span>}
      </div>
    </Modal>
  );
}

interface InstallRequestRow {
  id: number;
  hostname: string | null;
  requestedBy: string | null;
  confirmedBy: string | null;
  disruptiveAllowed: boolean;
  scheduleId: number | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  status: string;
  summary: string | null;
  rebootRequired: boolean | null;
  items: { key: string; title: string; outcome: string; message: string | null }[];
}

function statusTone(s: string): Tone {
  switch (s) {
    case "done":
      return "success";
    case "failed":
    case "interrupted":
      return "danger";
    case "partial":
    case "refused":
    case "expired":
      return "warning";
    case "running":
      return "info";
    default:
      return "neutral";
  }
}

function outcomeTone(o: string): Tone {
  return o === "installed" ? "success" : o === "failed" ? "danger" : o === "refused" ? "warning" : "neutral";
}

// Install requests for one device (queued / running / finished) with the per-update result. Polls while something is in flight.
export function InstallActivity({ deviceId, refreshKey, onSettled }: { deviceId: string; refreshKey: number; onSettled?: () => void }) {
  const [rows, setRows] = useState<InstallRequestRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/security-updates/requests?deviceId=${encodeURIComponent(deviceId)}&limit=5`);
      const json = (await parseJsonResponse(res)) as { ok: boolean; data?: InstallRequestRow[] };
      if (res.ok && json.ok) setRows(json.data ?? []);
    } catch {
      /* keep the last list */
    } finally {
      setLoaded(true);
    }
  }, [deviceId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const inFlight = rows.some((r) => r.status === "queued" || r.status === "running");
  useEffect(() => {
    if (!inFlight) return;
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [inFlight, load]);

  // When the last in-flight request finishes, let the parent refresh the update list.
  const [wasInFlight, setWasInFlight] = useState(false);
  useEffect(() => {
    if (wasInFlight && !inFlight) onSettled?.();
    setWasInFlight(inFlight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inFlight]);

  if (!loaded || rows.length === 0) return null;
  return (
    <div>
      <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.4rem" }}>Install activity</h3>
      <div className="flex flex-col gap-2" style={{ fontSize: "0.8rem" }}>
        {rows.map((r) => (
          <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem 0.65rem" }}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(r.status)}>{r.status}</Badge>
              <span style={{ color: "var(--ink-muted)" }}>
                #{r.id} - {formatUtcTimestamp(r.createdAt)} - by {r.requestedBy ?? "unknown"}
                {r.disruptiveAllowed && r.confirmedBy ? ` (disruptive confirmed by ${r.confirmedBy})` : ""}
              </span>
              {r.rebootRequired && <Badge tone="warning">restart required</Badge>}
            </div>
            {r.status === "queued" && <div style={{ color: "var(--ink-muted)" }}>Waiting for the agent to pick it up (next heartbeat).</div>}
            {r.status === "running" && <div style={{ color: "var(--ink-muted)" }}>Installing on the device...</div>}
            {r.items.length > 0 && (
              <ul style={{ margin: "0.3rem 0 0", paddingLeft: "1.1rem" }}>
                {r.items.map((i) => (
                  <li key={i.key}>
                    {i.title} <Badge tone={outcomeTone(i.outcome)}>{i.outcome}</Badge>
                    {i.outcome !== "installed" && i.message ? <span style={{ color: "var(--ink-muted)" }}> - {i.message}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
