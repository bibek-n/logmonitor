import { HeartPulse, Globe, Gauge, HardDrive, Clock, Users, ShieldAlert, MapPinned } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DemoBadge } from "./DemoBadge";
import type { MyIpSummary } from "@/lib/ipTools";
import type { CountryTraffic } from "@/lib/trafficByCountry";
import type { ThreatSummary } from "@/lib/threatSummary";

interface LatestSpeedTest {
  pingMs: number | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
  createdAt: string;
}

interface TopDevice {
  ip: string;
  name: string | null;
  eventCount: number;
}

interface RightRailProps {
  healthScore: number;
  ip: MyIpSummary | null;
  latestSpeedTest: LatestSpeedTest | null;
  topDevices: TopDevice[];
  monitoringSince: string | null;
  diskFreePct: number | null;
  trafficByCountry: CountryTraffic[];
  threatSummary: ThreatSummary;
}

function healthColor(score: number): string {
  if (score >= 85) return "var(--success)";
  if (score >= 60) return "var(--warning)";
  return "var(--danger)";
}

function formatDuration(from: string): string {
  const ms = Date.now() - new Date(from).getTime();
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

function Row({ icon: Icon, label, value }: { icon: typeof Globe; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: "0.4rem 0" }}>
      <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "var(--ink-muted)" }}>
        <Icon size={13} />
        {label}
      </span>
      <span style={{ fontSize: "0.8rem", color: "var(--ink)", fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export function RightRail({ healthScore, ip, latestSpeedTest, topDevices, monitoringSince, diskFreePct, trafficByCountry, threatSummary }: RightRailProps) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex items-center gap-2" style={{ marginBottom: "0.75rem" }}>
          <HeartPulse size={16} style={{ color: healthColor(healthScore) }} />
          <h2 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Live Health Score</h2>
        </div>
        <div style={{ fontSize: "2.2rem", fontWeight: 700, color: healthColor(healthScore) }}>{healthScore}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Composite of CPU, memory, disk &amp; open alerts</div>
      </Card>

      <Card>
        <h2 style={{ fontSize: "0.9rem", margin: "0 0 0.4rem", color: "var(--ink)" }}>Network</h2>
        <Row icon={Globe} label="Public IP" value={ip?.ip ?? "Unavailable"} />
        <Row icon={MapPinned} label="ISP / Location" value={ip ? `${ip.isp ?? "-"}, ${ip.city ?? ip.country ?? "-"}` : "-"} />
        <Row
          icon={Gauge}
          label="Last Speed Test"
          value={
            latestSpeedTest
              ? `${latestSpeedTest.downloadMbps?.toFixed(1) ?? "-"} / ${latestSpeedTest.uploadMbps?.toFixed(1) ?? "-"} Mbps`
              : "Never run"
          }
        />
        <Row icon={Clock} label="Latency" value={latestSpeedTest?.pingMs != null ? `${latestSpeedTest.pingMs} ms` : "-"} />
      </Card>

      <Card>
        <h2 style={{ fontSize: "0.9rem", margin: "0 0 0.4rem", color: "var(--ink)" }}>System</h2>
        <Row icon={Clock} label="Monitoring Uptime" value={monitoringSince ? formatDuration(monitoringSince) : "-"} />
        <Row icon={HardDrive} label="Storage Free (worst partition)" value={diskFreePct != null ? `${diskFreePct.toFixed(0)}%` : "-"} />
      </Card>

      <Card>
        <h2 style={{ fontSize: "0.9rem", margin: "0 0 0.4rem", color: "var(--ink)" }}>Top 10 Most Active Devices</h2>
        <p style={{ fontSize: "0.72rem", color: "var(--ink-muted)", margin: "0 0 0.5rem" }}>By web filter events, last 4h</p>
        {topDevices.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>No activity in the last 24h.</p>
        ) : (
          topDevices.map((d) => (
            <div key={d.ip} className="flex items-center justify-between" style={{ padding: "0.3rem 0" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--ink)" }}>{d.name ?? d.ip}</span>
              <span style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>{d.eventCount} events</span>
            </div>
          ))
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between" style={{ marginBottom: "0.4rem" }}>
          <h2 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <ShieldAlert size={15} />
            Threat Detection
          </h2>
        </div>
        <Row icon={ShieldAlert} label="Blocked (24h)" value={String(threatSummary.blocked24h)} />
        <Row icon={ShieldAlert} label="Critical" value={String(threatSummary.critical24h)} />
        <p style={{ fontSize: "0.72rem", color: "var(--ink-muted)", marginTop: "0.4rem" }}>
          From Sophos Firewall/IPS/Anti-Virus logs, last 24h.
        </p>
      </Card>

      <Card>
        <div className="flex items-center justify-between" style={{ marginBottom: "0.4rem" }}>
          <h2 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Users size={15} />
            Traffic by Country
          </h2>
        </div>
        {trafficByCountry.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>
            No outbound traffic seen from the router/firewall in the last 24h yet.
          </p>
        ) : (
          <>
            {trafficByCountry.map((row) => (
              <div key={row.country} style={{ marginBottom: "0.4rem" }}>
                <div className="flex justify-between" style={{ fontSize: "0.75rem", color: "var(--ink-secondary)" }}>
                  <span>{row.country}</span>
                  <span>{row.pct}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 999, background: "var(--border)", overflow: "hidden" }}>
                  <div style={{ width: `${row.pct}%`, height: "100%", background: "var(--info)" }} />
                </div>
              </div>
            ))}
            <p style={{ fontSize: "0.72rem", color: "var(--ink-muted)", marginTop: "0.4rem" }}>
              Based on destination IPs from the last 24h of MikroTik and Sophos traffic, geolocated.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
