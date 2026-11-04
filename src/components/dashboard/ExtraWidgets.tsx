import Link from "next/link";
import { WifiOff, ShieldAlert, Bug, Gauge, Laptop, Server, CalendarClock, Router, Users, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

// Four new Overview-page widgets added alongside the existing ones as part of making the
// dashboard customizable - each reuses an already-battle-tested query rather than inventing a
// new one (getOfflineDevices/getExpiringSslCertificates from the AI Assistant's tool functions,
// getTopIps from Top Consumers), so the numbers shown here always agree with what those other
// features already report.

export function OfflineDevicesCard({ devices }: { devices: { device: string; type: string; lastHeartbeat: string | null }[] }) {
  return (
    <Card hoverLift tilt3d>
      <div className="flex items-center gap-2" style={{ marginBottom: "0.6rem" }}>
        <WifiOff size={16} style={{ color: devices.length > 0 ? "var(--danger)" : "var(--ink-muted)" }} />
        <h2 style={{ fontSize: "0.9rem", margin: 0 }}>Offline Devices</h2>
      </div>
      {devices.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>Everything enrolled is online.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {devices.slice(0, 6).map((d) => (
            <div key={d.device} className="flex items-center justify-between" style={{ fontSize: "0.8rem" }}>
              <span>{d.device}</span>
              <span style={{ color: "var(--ink-muted)" }}>{d.lastHeartbeat ? new Date(d.lastHeartbeat).toLocaleString() : "Never"}</span>
            </div>
          ))}
          {devices.length > 6 && <span style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>+{devices.length - 6} more</span>}
        </div>
      )}
    </Card>
  );
}

export function ExpiringSslCard({ certs }: { certs: { server: string | null; site: string; expiresAt: string | null; alreadyExpired: boolean }[] }) {
  return (
    <Card hoverLift tilt3d>
      <div className="flex items-center gap-2" style={{ marginBottom: "0.6rem" }}>
        <ShieldAlert size={16} style={{ color: certs.length > 0 ? "var(--warning)" : "var(--ink-muted)" }} />
        <h2 style={{ fontSize: "0.9rem", margin: 0 }}>SSL Certificates Expiring Soon</h2>
      </div>
      {certs.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>Nothing expiring within 30 days.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {certs.slice(0, 6).map((c, i) => (
            <div key={i} className="flex items-center justify-between" style={{ fontSize: "0.8rem" }}>
              <span>{c.site}</span>
              <Badge tone={c.alreadyExpired ? "danger" : "warning"}>{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "-"}</Badge>
            </div>
          ))}
          {certs.length > 6 && <span style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>+{certs.length - 6} more</span>}
        </div>
      )}
    </Card>
  );
}

export function MalwareFindingsCard({ findings }: { findings: { checkType: string; severity: string; target: string }[] }) {
  return (
    <Card hoverLift tilt3d>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.6rem" }}>
        <div className="flex items-center gap-2">
          <Bug size={16} style={{ color: findings.length > 0 ? "var(--danger)" : "var(--ink-muted)" }} />
          <h2 style={{ fontSize: "0.9rem", margin: 0 }}>Open Malware Findings</h2>
        </div>
        <Link href="/dashboard/malware-detection" style={{ fontSize: "0.78rem", color: "var(--primary)" }}>
          View all &rarr;
        </Link>
      </div>
      {findings.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>No open findings.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {findings.slice(0, 6).map((f, i) => (
            <div key={i} className="flex items-center justify-between" style={{ fontSize: "0.8rem" }}>
              <span>
                {f.checkType} - {f.target}
              </span>
              <Badge tone={f.severity === "Critical" || f.severity === "High" ? "danger" : "warning"}>{f.severity}</Badge>
            </div>
          ))}
          {findings.length > 6 && <span style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>+{findings.length - 6} more</span>}
        </div>
      )}
    </Card>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let i = -1;
  do {
    value /= 1024;
    i++;
  } while (value >= 1024 && i < units.length - 1);
  return `${value.toFixed(1)} ${units[i]}`;
}

export function TopBandwidthConsumersCard({ ips }: { ips: { ip: string; name: string | null; totalBytes: number }[] }) {
  return (
    <Card hoverLift tilt3d>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.6rem" }}>
        <div className="flex items-center gap-2">
          <Gauge size={16} />
          <h2 style={{ fontSize: "0.9rem", margin: 0 }}>Top Bandwidth Consumers (24h)</h2>
        </div>
        <Link href="/dashboard/top-consumers" style={{ fontSize: "0.78rem", color: "var(--primary)" }}>
          View all &rarr;
        </Link>
      </div>
      {ips.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>No data in the last 24h.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {ips.slice(0, 5).map((r) => (
            <div key={r.ip} className="flex items-center justify-between" style={{ fontSize: "0.8rem" }}>
              <span>{r.name ?? r.ip}</span>
              <span style={{ color: "var(--ink-muted)" }}>{formatBytes(r.totalBytes)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// Rebuilt 2026-10-27 after an accidental overwrite wiped these 6 exports (page.tsx still
// imported/used them, which is what actually crashed the dashboard) - prop shapes matched
// directly against src/lib/dashboardLayouts/queries.ts and src/lib/topConsumers.ts's real
// return types rather than guessed, so they line up with what page.tsx already passes in.

export function ConnectedDevicesCard({ devices }: { devices: { mac: string; ip: string; hostname: string | null; vendorName: string | null; source: "MikroTik" | "Sophos" }[] }) {
  return (
    <Card hoverLift tilt3d>
      <div className="flex items-center gap-2" style={{ marginBottom: "0.6rem" }}>
        <Laptop size={16} />
        <h2 style={{ fontSize: "0.9rem", margin: 0 }}>Connected Devices</h2>
      </div>
      {devices.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>Nothing connected right now.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {devices.slice(0, 6).map((d) => (
            <div key={d.mac} className="flex items-center justify-between" style={{ fontSize: "0.8rem" }}>
              <span>{d.hostname ?? d.vendorName ?? d.mac}</span>
              <span style={{ color: "var(--ink-muted)" }}>{d.ip}</span>
            </div>
          ))}
          {devices.length > 6 && <span style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>+{devices.length - 6} more</span>}
        </div>
      )}
    </Card>
  );
}

export function AllServersCard({ servers }: { servers: { deviceId: string; name: string; hostname: string; serverRole: string | null; isOnline: boolean; lastHeartbeat: string | null }[] }) {
  const offline = servers.filter((s) => !s.isOnline).length;
  return (
    <Card hoverLift tilt3d>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.6rem" }}>
        <div className="flex items-center gap-2">
          <Server size={16} style={{ color: offline > 0 ? "var(--danger)" : "var(--ink-muted)" }} />
          <h2 style={{ fontSize: "0.9rem", margin: 0 }}>Servers</h2>
        </div>
        <Link href="/dashboard/servers" style={{ fontSize: "0.78rem", color: "var(--primary)" }}>
          View all &rarr;
        </Link>
      </div>
      {servers.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>No servers registered yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {servers.slice(0, 6).map((s) => (
            <div key={s.deviceId} className="flex items-center justify-between" style={{ fontSize: "0.8rem" }}>
              <span>{s.name}{s.serverRole ? ` (${s.serverRole})` : ""}</span>
              <Badge tone={s.isOnline ? "success" : "danger"}>{s.isOnline ? "Online" : "Offline"}</Badge>
            </div>
          ))}
          {servers.length > 6 && <span style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>+{servers.length - 6} more</span>}
        </div>
      )}
    </Card>
  );
}

export function DomainExpiryCard({ domains }: { domains: { domain: string; siteNames: string; registrar: string | null; expiresAt: string | null; alreadyExpired: boolean; noData: boolean }[] }) {
  const relevant = domains.filter((d) => !d.noData);
  return (
    <Card hoverLift tilt3d>
      <div className="flex items-center gap-2" style={{ marginBottom: "0.6rem" }}>
        <CalendarClock size={16} style={{ color: relevant.length > 0 ? "var(--warning)" : "var(--ink-muted)" }} />
        <h2 style={{ fontSize: "0.9rem", margin: 0 }}>Domains Expiring Soon</h2>
      </div>
      {relevant.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>Nothing expiring within 60 days.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {relevant.slice(0, 6).map((d, i) => (
            <div key={i} className="flex items-center justify-between" style={{ fontSize: "0.8rem" }}>
              <span>{d.domain}</span>
              <Badge tone={d.alreadyExpired ? "danger" : "warning"}>{d.expiresAt ? new Date(d.expiresAt).toLocaleDateString() : "-"}</Badge>
            </div>
          ))}
          {relevant.length > 6 && <span style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>+{relevant.length - 6} more</span>}
        </div>
      )}
    </Card>
  );
}

export function TopBandwidthRouterClientsCard({ clients }: { clients: { ip: string; name: string | null; totalBytes: number; flows: number }[] }) {
  return (
    <Card hoverLift tilt3d>
      <div className="flex items-center gap-2" style={{ marginBottom: "0.6rem" }}>
        <Router size={16} />
        <h2 style={{ fontSize: "0.9rem", margin: 0 }}>Top Bandwidth — Router Clients</h2>
      </div>
      {clients.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>No data in the last 24h.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {clients.slice(0, 5).map((c) => (
            <div key={c.ip} className="flex items-center justify-between" style={{ fontSize: "0.8rem" }}>
              <span>{c.name ?? c.ip}</span>
              <span style={{ color: "var(--ink-muted)" }}>{formatBytes(c.totalBytes)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function TopBandwidthStaffCard({ staff }: { staff: { name: string; ipAddresses: string[]; totalBytes: number }[] }) {
  return (
    <Card hoverLift tilt3d>
      <div className="flex items-center gap-2" style={{ marginBottom: "0.6rem" }}>
        <Users size={16} />
        <h2 style={{ fontSize: "0.9rem", margin: 0 }}>Top Bandwidth — Staff</h2>
      </div>
      {staff.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>No data in the last 24h.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {staff.slice(0, 5).map((s, i) => (
            <div key={i} className="flex items-center justify-between" style={{ fontSize: "0.8rem" }}>
              <span>{s.name}</span>
              <span style={{ color: "var(--ink-muted)" }}>{formatBytes(s.totalBytes)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function TopVisitedCard({ sites }: { sites: { name: string; source: "sophos" | "mikrotik"; requests: number; totalBytes: number }[] }) {
  return (
    <Card hoverLift tilt3d>
      <div className="flex items-center gap-2" style={{ marginBottom: "0.6rem" }}>
        <TrendingUp size={16} />
        <h2 style={{ fontSize: "0.9rem", margin: 0 }}>Top Visited Sites</h2>
      </div>
      {sites.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>No data in the last 24h.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sites.slice(0, 6).map((s, i) => (
            <div key={i} className="flex items-center justify-between" style={{ fontSize: "0.8rem" }}>
              <span>{s.name}</span>
              <span style={{ color: "var(--ink-muted)" }}>{s.requests} reqs</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
