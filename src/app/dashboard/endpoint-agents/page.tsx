import { getDb } from "@/lib/db";
import { getAdminSession } from "@/lib/requireAdmin";
import { DeviceGrid, type DeviceRow } from "@/components/endpointAgents/DeviceGrid";

export const dynamic = "force-dynamic";

const ONLINE_THRESHOLD_SECONDS = 90; // 3x the 30s heartbeat interval

interface DeviceQueryRow {
  DeviceId: string;
  Hostname: string;
  OS: string;
  OsVersion: string | null;
  Department: string | null;
  AgentVersion: string | null;
  LastHeartbeat: string | null;
  LastIp: string | null;
  ScreenshotIntervalMinutes: number | null;
  PrivacyMode: boolean;
  StaffId: number | null;
  StaffName: string | null;
  CpuPct: number | null;
  MemPct: number | null;
  DiskPct: number | null;
  NetRxMbps: number | null;
  NetTxMbps: number | null;
  UptimeSeconds: number | null;
  LastScreenshotAt: string | null;
  FirewallEnabled: boolean | null;
  AntivirusStatus: string | null;
  DefenderStatus: string | null;
}

function computeHealthScore(r: DeviceQueryRow): number {
  let score = 100;
  if (r.CpuPct != null) score -= r.CpuPct > 90 ? 20 : r.CpuPct > 75 ? 8 : 0;
  if (r.MemPct != null) score -= r.MemPct > 90 ? 20 : r.MemPct > 75 ? 8 : 0;
  if (r.DiskPct != null) score -= r.DiskPct > 90 ? 15 : r.DiskPct > 75 ? 6 : 0;
  if (r.FirewallEnabled === false) score -= 15;
  if (r.AntivirusStatus === "disabled" || r.DefenderStatus === "disabled") score -= 20;
  return Math.max(0, Math.round(score));
}

export default async function EndpointAgentsPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Endpoint Agents</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view endpoint agent data.</p>
      </div>
    );
  }

  const db = await getDb();

  const result = await db.query<DeviceQueryRow>(`
    SELECT
      d.DeviceId, d.Hostname, d.OS, d.OsVersion, d.Department, d.AgentVersion,
      d.LastHeartbeat, d.LastIp, d.ScreenshotIntervalMinutes, d.PrivacyMode,
      d.StaffId, s.Name AS StaffName,
      metrics.CpuPct, metrics.MemPct, metrics.DiskPct, metrics.NetRxMbps, metrics.NetTxMbps, metrics.UptimeSeconds,
      shot.CapturedAt AS LastScreenshotAt,
      sec.FirewallEnabled, sec.AntivirusStatus, sec.DefenderStatus
    FROM Devices d
    LEFT JOIN Staff s ON s.Id = d.StaffId
    OUTER APPLY (
      SELECT TOP 1 CpuPct, MemPct, DiskPct, NetRxMbps, NetTxMbps, UptimeSeconds
      FROM DeviceMetrics m WHERE m.DeviceId = d.DeviceId ORDER BY ReceivedAt DESC
    ) metrics
    OUTER APPLY (
      SELECT TOP 1 CapturedAt FROM Screenshots sc
      WHERE sc.DeviceId = d.DeviceId AND sc.DeletedAt IS NULL ORDER BY CapturedAt DESC
    ) shot
    LEFT JOIN DeviceSecurityStatus sec ON sec.DeviceId = d.DeviceId
    ORDER BY d.Hostname
  `);

  const devices: DeviceRow[] = result.recordset.map((r) => {
    const online = r.LastHeartbeat ? Date.now() - new Date(r.LastHeartbeat).getTime() <= ONLINE_THRESHOLD_SECONDS * 1000 : false;
    return {
      deviceId: r.DeviceId,
      hostname: r.Hostname,
      os: r.OS,
      osVersion: r.OsVersion,
      department: r.Department,
      agentVersion: r.AgentVersion,
      staffId: r.StaffId,
      staffName: r.StaffName,
      lastIp: r.LastIp,
      online,
      lastHeartbeat: r.LastHeartbeat,
      screenshotIntervalMinutes: r.ScreenshotIntervalMinutes,
      privacyMode: r.PrivacyMode,
      cpuPct: r.CpuPct,
      memPct: r.MemPct,
      diskPct: r.DiskPct,
      netRxMbps: r.NetRxMbps,
      netTxMbps: r.NetTxMbps,
      uptimeSeconds: r.UptimeSeconds,
      lastScreenshotAt: r.LastScreenshotAt,
      healthScore: computeHealthScore(r),
    };
  });

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Endpoint Agents</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Devices with the Log Monitor endpoint agent installed. Online status is based on the agent&apos;s 30s
        heartbeat (offline if none in the last {ONLINE_THRESHOLD_SECONDS} seconds). Screenshot capture requires
        staff consent at enrollment and can be disabled per-device via Privacy Mode.
      </p>
      <DeviceGrid devices={devices} />
    </div>
  );
}
