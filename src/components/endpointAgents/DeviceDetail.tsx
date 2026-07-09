"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Download, Trash2, X, ShieldOff } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export interface DeviceDetailData {
  deviceId: string;
  hostname: string;
  os: string;
  osVersion: string | null;
  agentVersion: string | null;
  department: string | null;
  staffId: number | null;
  staffName: string | null;
  lastIp: string | null;
  online: boolean;
  screenshotIntervalMinutes: number | null;
  privacyMode: boolean;
  enrolledAt: string;
  consentAcceptedAt: string | null;
}

export interface MetricPoint {
  t: string;
  cpu: number | null;
  mem: number | null;
  disk: number | null;
  netRx: number | null;
  netTx: number | null;
}

export interface ScreenshotRow {
  id: number;
  capturedAt: string;
  capturedBy: string;
  fileSizeBytes: number;
  requestedByUsername: string | null;
}

const INTERVAL_OPTIONS = [
  { value: "", label: "Disabled" },
  { value: "1", label: "Every 1 min" },
  { value: "5", label: "Every 5 min" },
  { value: "15", label: "Every 15 min" },
  { value: "30", label: "Every 30 min" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SettingsPanel({ device }: { device: DeviceDetailData }) {
  const router = useRouter();
  const [interval, setInterval_] = useState(device.screenshotIntervalMinutes?.toString() ?? "");
  const [privacyMode, setPrivacyMode] = useState(device.privacyMode);
  const [department, setDepartment] = useState(device.department ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/devices/${device.deviceId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screenshotIntervalMinutes: interval === "" ? null : Number(interval),
          privacyMode,
          department: department === "" ? null : department,
        }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 style={{ fontSize: "0.95rem", margin: 0 }}>Settings</h2>
      <div className="flex flex-col gap-1">
        <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>Screenshot interval</label>
        <select
          value={interval}
          onChange={(e) => setInterval_(e.target.value)}
          style={{ padding: "0.5rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)" }}
        >
          {INTERVAL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2" style={{ fontSize: "0.85rem" }}>
        <input type="checkbox" checked={privacyMode} onChange={(e) => setPrivacyMode(e.target.checked)} />
        Privacy mode (disables screenshot capture entirely, overrides interval)
      </label>
      <div className="flex flex-col gap-1">
        <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>Department</label>
        <input
          type="text"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="e.g. Engineering"
          style={{ padding: "0.5rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)" }}
        />
      </div>
      <Button size="sm" onClick={save} disabled={saving}>
        {saving ? "Saving..." : saved ? "Saved" : "Save settings"}
      </Button>
    </Card>
  );
}

function ScreenshotViewerModal({ screenshot, onClose }: { screenshot: ScreenshotRow; onClose: () => void }) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (confirmText !== "DELETE") return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/screenshots/${screenshot.id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
        onClose();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
      onClick={onClose}
    >
      <div
        style={{ maxWidth: "90vw", maxHeight: "90vh", display: "flex", flexDirection: "column", gap: "0.75rem" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span style={{ color: "#fff", fontSize: "0.85rem" }}>{new Date(screenshot.capturedAt).toLocaleString()}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}>
            <X size={22} />
          </button>
        </div>
        <img
          src={`/api/admin/screenshots/${screenshot.id}/file`}
          alt={`Screenshot from ${screenshot.capturedAt}`}
          style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 8 }}
        />
        <div className="flex items-center gap-3 flex-wrap">
          <a href={`/api/admin/screenshots/${screenshot.id}/file?download=1`}>
            <Button size="sm" variant="secondary">
              <Download size={13} /> Download
            </Button>
          </a>
          <input
            type="text"
            placeholder='Type "DELETE" to confirm'
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            style={{ padding: "0.4rem 0.6rem", borderRadius: 6, border: "1px solid var(--border)", fontSize: "0.8rem" }}
          />
          <Button size="sm" variant="danger" disabled={confirmText !== "DELETE" || deleting} onClick={handleDelete}>
            <Trash2 size={13} /> Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScreenshotHistory({ screenshots }: { screenshots: ScreenshotRow[] }) {
  const [viewing, setViewing] = useState<ScreenshotRow | null>(null);

  if (screenshots.length === 0) {
    return (
      <Card>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", margin: 0 }}>No screenshots captured yet.</p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 style={{ fontSize: "0.95rem", marginTop: 0, marginBottom: "0.75rem" }}>Screenshot History</h2>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
        {screenshots.map((s) => (
          <button
            key={s.id}
            onClick={() => setViewing(s)}
            style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "none", padding: 0 }}
          >
            <img
              src={`/api/admin/screenshots/${s.id}/file`}
              alt={`Screenshot ${s.id}`}
              style={{ width: "100%", height: 90, objectFit: "cover", display: "block" }}
            />
            <div style={{ padding: "0.4rem", fontSize: "0.68rem", color: "var(--ink-secondary)", textAlign: "left" }}>
              <div>{new Date(s.capturedAt).toLocaleString()}</div>
              <div style={{ color: "var(--ink-muted)" }}>
                {s.capturedBy}
                {s.requestedByUsername ? ` by ${s.requestedByUsername}` : ""} &middot; {formatBytes(s.fileSizeBytes)}
              </div>
            </div>
          </button>
        ))}
      </div>
      {viewing && <ScreenshotViewerModal screenshot={viewing} onClose={() => setViewing(null)} />}
    </Card>
  );
}

function MetricsChart({ metrics }: { metrics: MetricPoint[] }) {
  if (metrics.length < 2) {
    return (
      <Card>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", margin: 0 }}>Not enough metrics history yet.</p>
      </Card>
    );
  }
  return (
    <Card>
      <h2 style={{ fontSize: "0.95rem", marginTop: 0, marginBottom: "0.75rem" }}>CPU / Memory / Disk</h2>
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={metrics} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="t" tickFormatter={(v) => new Date(v).toLocaleTimeString()} stroke="var(--ink-muted)" fontSize={11} tickLine={false} />
            <YAxis stroke="var(--ink-muted)" fontSize={11} tickLine={false} width={36} unit="%" />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.8rem" }}
              labelFormatter={(v) => new Date(v).toLocaleString()}
            />
            <Legend wrapperStyle={{ fontSize: "0.78rem" }} />
            <Area type="monotone" dataKey="cpu" name="CPU %" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
            <Area type="monotone" dataKey="mem" name="Memory %" stroke="var(--success)" fill="var(--success)" fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
            <Area type="monotone" dataKey="disk" name="Disk %" stroke="var(--warning)" fill="var(--warning)" fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function DeviceDetail({
  device,
  metrics,
  screenshots,
}: {
  device: DeviceDetailData;
  metrics: MetricPoint[];
  screenshots: ScreenshotRow[];
  staffOptions: { id: number; name: string }[];
}) {
  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>{device.hostname}</h1>
      <div className="flex items-center gap-2 mb-4" style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: device.online ? "var(--success)" : "var(--ink-muted)" }} />
        {device.online ? "Online" : "Offline"} &middot; {device.os} {device.osVersion ?? ""} &middot; agent v{device.agentVersion ?? "?"}
        {device.privacyMode && (
          <Badge tone="warning">
            <ShieldOff size={11} /> Privacy mode
          </Badge>
        )}
      </div>

      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <Card>
          <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>Assigned user</div>
          <div style={{ fontSize: "1rem" }}>{device.staffName ?? "Unassigned"}</div>
        </Card>
        <Card>
          <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>Last IP</div>
          <div style={{ fontSize: "1rem" }}>{device.lastIp ?? "-"}</div>
        </Card>
        <Card>
          <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>Enrolled</div>
          <div style={{ fontSize: "1rem" }}>{new Date(device.enrolledAt).toLocaleDateString()}</div>
        </Card>
        <Card>
          <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>Consent accepted</div>
          <div style={{ fontSize: "1rem" }}>{device.consentAcceptedAt ? new Date(device.consentAcceptedAt).toLocaleDateString() : "-"}</div>
        </Card>
      </div>

      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)" }}>
        <MetricsChart metrics={metrics} />
        <SettingsPanel device={device} />
      </div>

      <ScreenshotHistory screenshots={screenshots} />
    </div>
  );
}
