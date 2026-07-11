"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Camera, KeyRound, Laptop, MonitorX } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CopyButton } from "@/components/ui/CopyButton";

export interface DeviceRow {
  deviceId: string;
  hostname: string;
  os: string;
  osVersion: string | null;
  department: string | null;
  agentVersion: string | null;
  staffId: number | null;
  staffName: string | null;
  lastIp: string | null;
  online: boolean;
  lastHeartbeat: string | null;
  screenshotIntervalMinutes: number | null;
  privacyMode: boolean;
  cpuPct: number | null;
  memPct: number | null;
  diskPct: number | null;
  netRxMbps: number | null;
  netTxMbps: number | null;
  uptimeSeconds: number | null;
  lastScreenshotAt: string | null;
  healthScore: number;
}

function formatUptime(seconds: number | null): string {
  if (seconds == null) return "-";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function relTime(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return "just now";
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
}

function StatBar({ label, pct }: { label: string; pct: number | null }) {
  const color = pct == null ? "var(--ink-muted)" : pct > 90 ? "var(--danger)" : pct > 75 ? "var(--warning)" : "var(--success)";
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--ink-muted)" }}>
        <span>{label}</span>
        <span>{pct != null ? `${pct.toFixed(0)}%` : "-"}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
        <div style={{ width: `${Math.min(pct ?? 0, 100)}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}

function DeviceCard({ device }: { device: DeviceRow }) {
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [newToken, setNewToken] = useState<{ token: string; expiresAt: string } | null>(null);

  async function requestScreenshot() {
    setRequesting(true);
    try {
      const res = await fetch(`/api/admin/devices/${device.deviceId}/screenshot-request`, { method: "POST" });
      if (res.ok) setRequested(true);
    } finally {
      setRequesting(false);
    }
  }

  async function regenerateToken() {
    setRegenerating(true);
    try {
      const res = await fetch("/api/admin/enrollment-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preCreatedDeviceId: device.deviceId, staffId: device.staffId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) setNewToken({ token: data.token, expiresAt: data.expiresAt });
    } finally {
      setRegenerating(false);
    }
  }

  const serverUrl = typeof window !== "undefined" ? window.location.origin : "https://logs.tulipshrm.com:4433";

  return (
    <Card hoverLift className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: device.online ? "var(--success)" : "var(--ink-muted)",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <Link href={`/dashboard/endpoint-agents/${device.deviceId}`} style={{ color: "var(--ink)", fontWeight: 600, fontSize: "0.95rem" }}>
            {device.hostname}
          </Link>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge tone={device.healthScore >= 80 ? "success" : device.healthScore >= 50 ? "warning" : "danger"}>
            {device.healthScore}
          </Badge>
          <Badge tone={device.os === "windows" ? "info" : "success"}>{device.os}</Badge>
        </div>
      </div>

      <div style={{ fontSize: "0.78rem", color: "var(--ink-secondary)", display: "flex", flexDirection: "column", gap: 2 }}>
        <span>User: {device.staffName ?? "unassigned"}</span>
        <span>IP: {device.lastIp ?? "-"}</span>
        <span>Uptime: {formatUptime(device.uptimeSeconds)}</span>
        {device.department && <span>Dept: {device.department}</span>}
      </div>

      <div className="flex gap-3">
        <StatBar label="CPU" pct={device.cpuPct} />
        <StatBar label="RAM" pct={device.memPct} />
        <StatBar label="Disk" pct={device.diskPct} />
      </div>

      <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>
        Last screenshot: {device.privacyMode ? "privacy mode enabled" : relTime(device.lastScreenshotAt)}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={device.privacyMode || requesting || requested || !device.online}
          onClick={requestScreenshot}
        >
          <Camera size={13} />
          {requested ? "Requested" : "Screenshot now"}
        </Button>
        <Button size="sm" variant="secondary" disabled={regenerating} onClick={regenerateToken}>
          <KeyRound size={13} />
          {regenerating ? "Generating..." : "Regenerate token"}
        </Button>
        <Link href={`/dashboard/endpoint-agents/${device.deviceId}`} style={{ marginLeft: "auto" }}>
          <Button size="sm" variant="ghost">
            Details
          </Button>
        </Link>
      </div>

      <Modal open={!!newToken} onClose={() => setNewToken(null)} title={`Re-enroll ${device.hostname}`}>
        {newToken && (
          <div className="flex flex-col gap-3">
            <p style={{ fontSize: "0.82rem", color: "var(--ink-muted)", margin: 0 }}>
              Run this on the device to re-enroll it into its existing history (expires {new Date(newToken.expiresAt).toLocaleString()}):
            </p>
            <div className="flex items-center gap-2">
              <pre
                style={{
                  flex: 1,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0.75rem",
                  fontSize: "0.78rem",
                  overflowX: "auto",
                  margin: 0,
                }}
              >
                {newToken.token}
              </pre>
              <CopyButton value={newToken.token} />
            </div>
            <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>Windows</div>
            <pre style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem", fontSize: "0.76rem", overflowX: "auto", margin: 0 }}>
              {`agent.exe install --token=${newToken.token} --server=${serverUrl}`}
            </pre>
            <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>Linux</div>
            <pre style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem", fontSize: "0.76rem", overflowX: "auto", margin: 0 }}>
              {`curl -fsSL https://raw.githubusercontent.com/bibek-n/logmonitor/main/install.sh | sudo TOKEN=${newToken.token} SERVER_URL=${serverUrl} bash`}
            </pre>
          </div>
        )}
      </Modal>
    </Card>
  );
}

export function DeviceGrid({ devices }: { devices: DeviceRow[] }) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");

  const departments = useMemo(
    () => Array.from(new Set(devices.map((d) => d.department).filter((d): d is string => !!d))).sort(),
    [devices]
  );

  const filtered = devices.filter((d) => {
    const matchesSearch =
      !search ||
      d.hostname.toLowerCase().includes(search.toLowerCase()) ||
      (d.staffName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (d.lastIp ?? "").includes(search);
    const matchesDept = !department || d.department === department;
    return matchesSearch && matchesDept;
  });

  return (
    <div>
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search by hostname, user, or IP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: "1 1 260px",
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface-2)",
            color: "var(--ink)",
            fontSize: "0.85rem",
          }}
        />
        {departments.length > 0 && (
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--ink)",
              fontSize: "0.85rem",
            }}
          >
            <option value="">All departments</option>
            {departments.map((dep) => (
              <option key={dep} value={dep}>
                {dep}
              </option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-6" style={{ color: "var(--ink-muted)" }}>
            <MonitorX size={28} />
            <p>{devices.length === 0 ? "No devices enrolled yet." : "No devices match your search/filter."}</p>
            {devices.length === 0 && (
              <Link href="/dashboard/endpoint-agents/enroll" style={{ color: "var(--primary)", fontSize: "0.85rem" }}>
                Generate an enrollment token to install the agent on a device
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {filtered.map((d) => (
            <DeviceCard key={d.deviceId} device={d} />
          ))}
        </div>
      )}
      <div style={{ marginTop: "0.75rem", fontSize: "0.72rem", color: "var(--ink-muted)", display: "flex", alignItems: "center", gap: 6 }}>
        <Laptop size={12} /> {devices.length} device{devices.length === 1 ? "" : "s"} enrolled
      </div>
    </div>
  );
}
