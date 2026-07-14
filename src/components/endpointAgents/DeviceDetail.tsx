"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Download, Trash2, X, ShieldOff } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DeviceDetailExtras } from "@/components/endpointAgents/DeviceDetailExtras";

export interface HardwareInfo {
  cpuModel: string | null;
  cpuManufacturer: string | null;
  cpuCores: number | null;
  cpuThreads: number | null;
  cpuClockMhz: number | null;
  memoryTotalMB: number | null;
  diskModel: string | null;
  diskType: string | null;
  diskCapacityGB: number | null;
  gpuName: string | null;
  osEdition: string | null;
  osBuild: string | null;
  kernelVersion: string | null;
  architecture: string | null;
}

export interface DiskRow {
  diskIndex: number;
  model: string | null;
  type: string | null;
  capacityGB: number | null;
  healthStatus: string | null;
  operationalStatus: string | null;
  temperatureCelsius: number | null;
}

export interface DiskSpace {
  freeGB: number | null;
  totalGB: number | null;
}

export interface SecurityStatus {
  antivirusStatus: string | null;
  defenderStatus: string | null;
  firewallEnabled: boolean | null;
  firewallRulesCount: number | null;
  bitLockerStatus: string | null;
  luksStatus: string | null;
  secureBootEnabled: boolean | null;
  tpmVersion: string | null;
  selinuxStatus: string | null;
  apparmorStatus: string | null;
  failedLoginCount24h: number | null;
}

export interface NetworkInfo {
  currentIp: string | null;
  publicIp: string | null;
  gatewayIp: string | null;
  dnsServers: string | null;
  wifiSsid: string | null;
  vpnActive: boolean | null;
  ethernetConnected: boolean | null;
  openPorts: number[];
  listeningPorts: number[];
}

export interface ProcessRow {
  pid: number;
  ppid: number;
  name: string;
  cpuPercent: number;
  memPercent: number;
  diskReadMB?: number;
  diskWriteMB?: number;
  owner: string;
  startTime: number;
  cmdline: string;
  status: string;
  exePath: string;
  sha256: string;
}

export interface ServiceRow {
  name: string;
  displayName: string;
  status: string;
  startupType: string;
  execPath: string;
  account: string;
}

export interface SoftwareRow {
  name: string;
  version: string;
  publisher: string;
  installDate: string;
  installPath: string;
  sizeMB: number;
}

export interface DeviceAlertRow {
  id: number;
  alertType: string;
  severity: string;
  message: string;
  triggeredAt: string;
  resolvedAt: string | null;
}

export interface UsbEventRow {
  eventType: string;
  deviceName: string | null;
  serialNumber: string | null;
  storageCapacityGB: number | null;
  detectedAt: string;
}

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
  macAddress: string | null;
  online: boolean;
  screenshotIntervalMinutes: number | null;
  privacyMode: boolean;
  enrolledAt: string;
  consentAcceptedAt: string | null;
}

// Mirrors src/lib/deviceMatch.ts's shapes without importing that module directly — it
// pulls in getDb() and other server-only code that has no business in a client bundle.
export interface NetworkMatch {
  source: "mikrotik" | "sophos";
  ip: string | null;
  hostname: string | null;
}

export interface StaffMatch {
  id: number;
  name: string;
}

export interface DeviceMacMatch {
  networkMatches: NetworkMatch[];
  suggestedStaff: StaffMatch | null;
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

function SettingsPanel({ device, staffOptions }: { device: DeviceDetailData; staffOptions: { id: number; name: string }[] }) {
  const router = useRouter();
  const [interval, setInterval_] = useState(device.screenshotIntervalMinutes?.toString() ?? "");
  const [privacyMode, setPrivacyMode] = useState(device.privacyMode);
  const [department, setDepartment] = useState(device.department ?? "");
  const [staffId, setStaffId] = useState(device.staffId?.toString() ?? "");
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
          staffId: staffId === "" ? null : Number(staffId),
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
        <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>Assigned staff member</label>
        <select
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          style={{ padding: "0.5rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)" }}
        >
          <option value="">Unassigned</option>
          {staffOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
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

function EmployeeMatchCard({
  device,
  macMatch,
  staffOptions,
}: {
  device: DeviceDetailData;
  macMatch: DeviceMacMatch;
  staffOptions: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [assigning, setAssigning] = useState(false);

  async function assignSuggested() {
    if (!macMatch.suggestedStaff) return;
    setAssigning(true);
    try {
      const res = await fetch(`/api/admin/devices/${device.deviceId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: macMatch.suggestedStaff.id }),
      });
      if (res.ok) router.refresh();
    } finally {
      setAssigning(false);
    }
  }

  if (!device.macAddress) {
    return (
      <Card>
        <h2 style={{ fontSize: "0.95rem", marginTop: 0, marginBottom: "0.5rem" }}>Employee Match</h2>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem", margin: 0 }}>
          This agent hasn&apos;t reported a MAC address yet (older agent version, or not yet re-enrolled).
        </p>
      </Card>
    );
  }

  const staffAlreadyAssigned = staffOptions.find((s) => s.id === device.staffId);

  return (
    <Card className="flex flex-col gap-2">
      <h2 style={{ fontSize: "0.95rem", marginTop: 0, marginBottom: "0.25rem" }}>Employee Match</h2>
      <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>
        MAC address: <span style={{ color: "var(--ink)", fontFamily: "monospace" }}>{device.macAddress}</span>
      </div>

      {macMatch.networkMatches.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem", margin: 0 }}>
          Not currently seen on the MikroTik or Sophos network by this MAC.
        </p>
      ) : (
        macMatch.networkMatches.map((m) => (
          <div key={m.source} style={{ fontSize: "0.82rem" }}>
            Seen on <strong>{m.source === "mikrotik" ? "MikroTik" : "Sophos"}</strong>: {m.hostname ?? "unknown host"} (
            {m.ip ?? "-"})
          </div>
        ))
      )}

      {staffAlreadyAssigned ? (
        <Badge tone="success">Assigned to {staffAlreadyAssigned.name}</Badge>
      ) : macMatch.suggestedStaff ? (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone="info">Suggested match: {macMatch.suggestedStaff.name}</Badge>
          <Button size="sm" onClick={assignSuggested} disabled={assigning}>
            {assigning ? "Assigning..." : `Assign to ${macMatch.suggestedStaff.name}`}
          </Button>
        </div>
      ) : (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", margin: 0 }}>
          This MAC isn&apos;t linked to any Staff record yet — assign manually in Settings if known.
        </p>
      )}
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
  staffOptions,
  hardware,
  disks,
  diskSpace,
  security,
  network,
  processes,
  services,
  software,
  alerts,
  usbEvents,
  macMatch,
}: {
  device: DeviceDetailData;
  metrics: MetricPoint[];
  screenshots: ScreenshotRow[];
  staffOptions: { id: number; name: string }[];
  hardware: HardwareInfo | null;
  disks: DiskRow[];
  diskSpace: DiskSpace | null;
  security: SecurityStatus | null;
  network: NetworkInfo | null;
  processes: ProcessRow[];
  services: ServiceRow[];
  software: SoftwareRow[];
  alerts: DeviceAlertRow[];
  usbEvents: UsbEventRow[];
  macMatch: DeviceMacMatch;
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
        <div className="flex flex-col gap-4">
          <MetricsChart metrics={metrics} />
          <EmployeeMatchCard device={device} macMatch={macMatch} staffOptions={staffOptions} />
        </div>
        <SettingsPanel device={device} staffOptions={staffOptions} />
      </div>

      <ScreenshotHistory screenshots={screenshots} />

      <div className="mt-4">
        <DeviceDetailExtras
          hardware={hardware}
          disks={disks}
          diskSpace={diskSpace}
          security={security}
          network={network}
          processes={processes}
          services={services}
          software={software}
          alerts={alerts}
          usbEvents={usbEvents}
        />
      </div>
    </div>
  );
}
