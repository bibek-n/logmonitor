"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Usb } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type {
  HardwareInfo,
  DiskRow,
  DiskSpace,
  SecurityStatus,
  NetworkInfo,
  ProcessRow,
  ServiceRow,
  SoftwareRow,
  DeviceAlertRow,
  UsbEventRow,
} from "@/components/endpointAgents/DeviceDetail";

// Guards against a non-finite/missing value reaching .toFixed(), which throws - seen live
// as a client-side crash once real (rather than always-empty) data started flowing for a
// field that isn't guaranteed to always be a number.
function fmtNum(value: unknown, digits = 1): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "-";
}

// Picks the top N processes by whichever resource (CPU, memory, or disk I/O) each one is
// most notable for, rather than just sorting by one metric - a process that's disk-heavy
// but CPU-idle would never surface if this only ranked by CPU%. Ranks each process 1..N
// per dimension, keeps its best (lowest) rank across the three, then takes the N processes
// with the best combined rank.
function topProcessesByUsage(processes: ProcessRow[], limit: number): ProcessRow[] {
  if (processes.length <= limit) return processes;
  const rankBy = (key: (p: ProcessRow) => number) => {
    const sorted = [...processes].sort((a, b) => key(b) - key(a));
    const rank = new Map<ProcessRow, number>();
    sorted.forEach((p, i) => rank.set(p, i));
    return rank;
  };
  const cpuRank = rankBy((p) => (Number.isFinite(p.cpuPercent) ? p.cpuPercent : 0));
  const memRank = rankBy((p) => (Number.isFinite(p.memPercent) ? p.memPercent : 0));
  const diskRank = rankBy((p) => (p.diskReadMB ?? 0) + (p.diskWriteMB ?? 0));
  return [...processes]
    .sort((a, b) => {
      const bestA = Math.min(cpuRank.get(a)!, memRank.get(a)!, diskRank.get(a)!);
      const bestB = Math.min(cpuRank.get(b)!, memRank.get(b)!, diskRank.get(b)!);
      return bestA - bestB;
    })
    .slice(0, limit);
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div style={{ fontSize: "0.78rem", display: "flex", justifyContent: "space-between", gap: "0.5rem", padding: "0.15rem 0" }}>
      <span style={{ color: "var(--ink-muted)" }}>{label}</span>
      <span style={{ color: "var(--ink)", textAlign: "right" }}>{value ?? "-"}</span>
    </div>
  );
}

function statusTone(ok: boolean | null): "success" | "danger" | "neutral" {
  if (ok === null) return "neutral";
  return ok ? "success" : "danger";
}

function diskHealthTone(status: string | null): "success" | "warning" | "danger" | "neutral" {
  if (!status) return "neutral";
  if (status === "Healthy") return "success";
  if (status === "Warning") return "warning";
  return "danger";
}

function HardwareInfoCard({ hardware, disks, diskSpace }: { hardware: HardwareInfo | null; disks: DiskRow[]; diskSpace: DiskSpace | null }) {
  if (!hardware) {
    return (
      <Card>
        <h2 style={{ fontSize: "0.95rem", marginTop: 0 }}>Hardware</h2>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem", margin: 0 }}>No hardware info reported yet.</p>
      </Card>
    );
  }
  return (
    <Card>
      <h2 style={{ fontSize: "0.95rem", marginTop: 0, marginBottom: "0.5rem" }}>Hardware</h2>
      <Field label="CPU" value={hardware.cpuModel} />
      <Field label="Cores / Threads" value={hardware.cpuCores != null ? `${hardware.cpuCores} / ${hardware.cpuThreads}` : null} />
      <Field label="Clock speed" value={hardware.cpuClockMhz != null ? `${hardware.cpuClockMhz.toFixed(0)} MHz` : null} />
      <Field label="Memory" value={hardware.memoryTotalMB != null ? `${(hardware.memoryTotalMB / 1024).toFixed(1)} GB` : null} />
      <Field label="Disk" value={hardware.diskModel} />
      <Field
        label="Disk type / capacity"
        value={
          hardware.diskType || hardware.diskCapacityGB != null
            ? `${hardware.diskType ?? "unknown"}${hardware.diskCapacityGB != null ? ` · ${hardware.diskCapacityGB.toFixed(0)} GB` : ""}`
            : null
        }
      />
      <Field
        label="Free space"
        value={diskSpace?.freeGB != null && diskSpace?.totalGB != null ? `${diskSpace.freeGB.toFixed(1)} GB free of ${diskSpace.totalGB.toFixed(0)} GB` : null}
      />
      <Field label="GPU" value={hardware.gpuName} />
      {disks.length > 0 && (
        <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)", marginBottom: "0.3rem" }}>Disk health</div>
          {disks.map((d) => (
            <div key={d.diskIndex} className="flex items-center justify-between gap-2" style={{ fontSize: "0.78rem", padding: "0.15rem 0" }}>
              <span style={{ color: "var(--ink-muted)" }}>
                #{d.diskIndex} {d.model ?? ""}
                {d.temperatureCelsius != null ? ` · ${d.temperatureCelsius.toFixed(0)}°C` : ""}
              </span>
              {d.healthStatus && <Badge tone={diskHealthTone(d.healthStatus)}>{d.healthStatus}</Badge>}
            </div>
          ))}
        </div>
      )}
      <Field label="OS" value={hardware.osEdition} />
      <Field label="Kernel / build" value={hardware.kernelVersion ?? hardware.osBuild} />
      <Field label="Architecture" value={hardware.architecture} />
    </Card>
  );
}

function computeRiskScore(security: SecurityStatus | null): number {
  if (!security) return 100; // no data yet — not the same as "at risk"
  let score = 100;
  if (security.firewallEnabled === false) score -= 20;
  if (security.antivirusStatus === "disabled" || security.defenderStatus === "disabled") score -= 25;
  if (security.bitLockerStatus === "off" || security.luksStatus === "off") score -= 15;
  if (security.secureBootEnabled === false) score -= 10;
  if ((security.failedLoginCount24h ?? 0) > 5) score -= 15;
  if (security.selinuxStatus === "disabled" || security.apparmorStatus === "disabled") score -= 10;
  return Math.max(0, score);
}

function SecurityStatusCard({ security }: { security: SecurityStatus | null }) {
  const risk = computeRiskScore(security);
  const riskTone = risk >= 80 ? "success" : risk >= 50 ? "warning" : "danger";

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <h2 style={{ fontSize: "0.95rem", margin: 0 }}>Security Posture</h2>
        <Badge tone={riskTone}>Risk score: {risk}</Badge>
      </div>
      {!security ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem", margin: 0 }}>No security status reported yet.</p>
      ) : (
        <>
          <Field label="Antivirus" value={security.antivirusStatus ?? security.defenderStatus} />
          <div className="flex items-center justify-between" style={{ fontSize: "0.78rem", padding: "0.15rem 0" }}>
            <span style={{ color: "var(--ink-muted)" }}>Firewall</span>
            <Badge tone={statusTone(security.firewallEnabled)}>
              {security.firewallEnabled === null ? "unknown" : security.firewallEnabled ? "enabled" : "disabled"}
            </Badge>
          </div>
          <Field label="Firewall rules" value={security.firewallRulesCount} />
          <Field label="Disk encryption" value={security.bitLockerStatus ?? security.luksStatus} />
          <div className="flex items-center justify-between" style={{ fontSize: "0.78rem", padding: "0.15rem 0" }}>
            <span style={{ color: "var(--ink-muted)" }}>Secure Boot</span>
            <Badge tone={statusTone(security.secureBootEnabled)}>
              {security.secureBootEnabled === null ? "unknown" : security.secureBootEnabled ? "on" : "off"}
            </Badge>
          </div>
          <Field label="TPM" value={security.tpmVersion} />
          <Field label="SELinux / AppArmor" value={security.selinuxStatus ?? security.apparmorStatus} />
          <Field label="Failed logins (24h)" value={security.failedLoginCount24h} />
        </>
      )}
    </Card>
  );
}

function NetworkInfoCard({ network }: { network: NetworkInfo | null }) {
  if (!network) {
    return (
      <Card>
        <h2 style={{ fontSize: "0.95rem", marginTop: 0 }}>Network</h2>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem", margin: 0 }}>No network info reported yet.</p>
      </Card>
    );
  }
  return (
    <Card>
      <h2 style={{ fontSize: "0.95rem", marginTop: 0, marginBottom: "0.5rem" }}>Network</h2>
      <Field label="Local IP" value={network.currentIp} />
      <Field label="Public IP" value={network.publicIp} />
      <Field label="Gateway" value={network.gatewayIp} />
      <Field label="DNS servers" value={network.dnsServers} />
      <Field label="WiFi SSID" value={network.wifiSsid} />
      <Field label="Ethernet" value={network.ethernetConnected ? "connected" : "not connected"} />
      <Field label="VPN" value={network.vpnActive ? "active (heuristic)" : "not detected"} />
      <Field label="Listening ports" value={network.listeningPorts.length ? network.listeningPorts.sort((a, b) => a - b).join(", ") : "-"} />
    </Card>
  );
}

function SearchableTable<T>({
  title,
  rows,
  columns,
  searchFields,
  emptyLabel,
}: {
  title: string;
  rows: T[];
  columns: { label: string; render: (row: T) => React.ReactNode }[];
  searchFields: (row: T) => string;
  emptyLabel: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () => rows.filter((r) => !search || searchFields(r).toLowerCase().includes(search.toLowerCase())),
    [rows, search, searchFields]
  );

  return (
    <Card>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h2 style={{ fontSize: "0.95rem", margin: 0 }}>
          {title} ({rows.length})
        </h2>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "0.35rem 0.6rem",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--surface-2)",
            color: "var(--ink)",
            fontSize: "0.78rem",
          }}
        />
      </div>
      {rows.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem", margin: 0 }}>{emptyLabel}</p>
      ) : (
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--surface)" }}>
                {columns.map((c) => (
                  <th key={c.label} style={{ padding: "0.4rem", color: "var(--ink-muted)", fontWeight: 500 }}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--grid)" }}>
                  {columns.map((c) => (
                    <td key={c.label} style={{ padding: "0.4rem" }}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem", padding: "0.5rem" }}>No matches.</p>}
        </div>
      )}
    </Card>
  );
}

function AlertsAndUsbCard({ alerts, usbEvents }: { alerts: DeviceAlertRow[]; usbEvents: UsbEventRow[] }) {
  return (
    <Card>
      <h2 style={{ fontSize: "0.95rem", marginTop: 0, marginBottom: "0.5rem" }}>Alerts &amp; USB History</h2>
      {alerts.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>No alerts.</p>
      ) : (
        <div className="flex flex-col gap-1 mb-3" style={{ maxHeight: 180, overflowY: "auto" }}>
          {alerts.map((a) => (
            <div key={a.id} className="flex items-center gap-2" style={{ fontSize: "0.78rem" }}>
              <Badge tone={a.severity === "critical" ? "danger" : a.severity === "warning" ? "warning" : "info"}>{a.severity}</Badge>
              <span style={{ color: a.resolvedAt ? "var(--ink-muted)" : "var(--ink)" }}>{a.message}</span>
              <span style={{ color: "var(--ink-muted)", marginLeft: "auto", flexShrink: 0 }}>
                {new Date(a.triggeredAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
      {usbEvents.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>No USB events recorded.</p>
      ) : (
        <div className="flex flex-col gap-1" style={{ maxHeight: 160, overflowY: "auto" }}>
          {usbEvents.map((u, i) => (
            <div key={i} className="flex items-center gap-2" style={{ fontSize: "0.78rem" }}>
              <Usb size={12} style={{ color: u.eventType === "insert" ? "var(--success)" : "var(--ink-muted)" }} />
              <span>
                {u.eventType === "insert" ? "Inserted" : "Removed"}: {u.deviceName ?? "Unknown device"}
                {u.vendorName ? ` — ${u.vendorName}` : u.vendorId ? ` — VID ${u.vendorId}` : ""}
                {u.storageCapacityGB ? ` (${u.storageCapacityGB.toFixed(0)} GB)` : ""}
              </span>
              <span style={{ color: "var(--ink-muted)", marginLeft: "auto", flexShrink: 0 }}>
                {new Date(u.detectedAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function DeviceDetailExtras({
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
}: {
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
}) {
  const router = useRouter();
  const topProcesses = useMemo(() => topProcessesByUsage(processes, 10), [processes]);
  const runningServices = useMemo(() => services.filter((s) => s.status === "running"), [services]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 style={{ fontSize: "1rem", margin: 0 }}>Inventory &amp; Posture</h2>
        <Button size="sm" variant="ghost" onClick={() => router.refresh()}>
          <RefreshCw size={13} /> Refresh
        </Button>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <HardwareInfoCard hardware={hardware} disks={disks} diskSpace={diskSpace} />
        <SecurityStatusCard security={security} />
        <NetworkInfoCard network={network} />
      </div>

      <SearchableTable
        title="Top Processes (CPU / Memory / Disk)"
        rows={topProcesses}
        emptyLabel="No process snapshot reported yet."
        searchFields={(p) => `${p.name} ${p.owner} ${p.cmdline}`}
        columns={[
          { label: "PID", render: (p) => p.pid },
          { label: "Name", render: (p) => p.name },
          { label: "CPU %", render: (p) => fmtNum(p.cpuPercent) },
          { label: "Mem %", render: (p) => fmtNum(p.memPercent) },
          { label: "Disk Read (MB)", render: (p) => fmtNum(p.diskReadMB, 0) },
          { label: "Disk Write (MB)", render: (p) => fmtNum(p.diskWriteMB, 0) },
          { label: "Owner", render: (p) => p.owner },
          { label: "Status", render: (p) => p.status },
        ]}
      />

      <SearchableTable
        title="Running Services"
        rows={runningServices}
        emptyLabel="No running services reported yet."
        searchFields={(s) => `${s.name} ${s.displayName}`}
        columns={[
          { label: "Name", render: (s) => s.displayName || s.name },
          {
            label: "Status",
            render: (s) => (
              <Badge tone={s.status === "running" ? "success" : s.status === "failed" ? "danger" : "neutral"}>{s.status}</Badge>
            ),
          },
          { label: "Startup", render: (s) => s.startupType },
        ]}
      />

      <SearchableTable
        title="Installed Software"
        rows={software}
        emptyLabel="No software inventory reported yet."
        searchFields={(s) => `${s.name} ${s.publisher}`}
        columns={[
          { label: "Name", render: (s) => s.name },
          { label: "Version", render: (s) => s.version },
          { label: "Publisher", render: (s) => s.publisher },
          { label: "Installed", render: (s) => s.installDate || "-" },
        ]}
      />

      <AlertsAndUsbCard alerts={alerts} usbEvents={usbEvents} />
    </div>
  );
}
