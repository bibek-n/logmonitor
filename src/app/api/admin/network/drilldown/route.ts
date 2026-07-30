import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

// Sophos status/action values meaning "the firewall stopped this" - same list and reasoning
// as src/lib/threatSummary.ts's BLOCKED_VALUES (kept in sync manually since this is the only
// other place in the app that needs it): naming varies by log category, so this is checked
// case-insensitively against whatever value is present rather than a single expected string.
const BLOCKED_VALUES = ["deny", "denied", "drop", "dropped", "block", "blocked", "reject", "rejected", "quarantine", "quarantined"];

interface MetricPoint {
  t: string;
  cpu: number | null;
  mem: number | null;
  disk: number | null;
}

interface BlockedEvent {
  receivedAt: string;
  source: "threat" | "webfilter";
  blocked: boolean;
  detail: string;
}

// Aggregates everything the drill-down side panel needs for a given IP - deliberately keyed
// by IP rather than DeviceId, because two of the four data sources (RouterClients DHCP
// leases, Sophos threat/webfilter logs) only ever know about an IP, not a LogMonitor-enrolled
// device. This makes the panel work for *any* host on the network someone clicks on
// (RightRail's Top 10 Most Active Devices is IP-first, not device-first), not just ones
// running the agent - a matching Devices row (and therefore CPU/Mem history + MAC from the
// agent) is treated as optional, present only when that IP happens to also be enrolled.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { searchParams } = new URL(req.url);
  const ip = searchParams.get("ip") ?? "";
  const hours = Math.min(48, Math.max(1, parseInt(searchParams.get("hours") ?? "4", 10) || 4));
  if (!ip) {
    return NextResponse.json({ ok: false, error: "ip query param is required" }, { status: 400 });
  }

  const db = await getDb();

  const deviceResult = await db
    .request()
    .input("ip", sql.VarChar, ip)
    .query<{ DeviceId: string; DeviceName: string | null; Hostname: string; MacAddress: string | null }>(`
      SELECT TOP 1 DeviceId, DeviceName, Hostname, MacAddress
      FROM Devices WHERE StaticIpAddress = @ip OR LastIp = @ip
      ORDER BY CASE WHEN StaticIpAddress = @ip THEN 0 ELSE 1 END
    `);
  const device = deviceResult.recordset[0] ?? null;

  let metrics: MetricPoint[] = [];
  if (device) {
    const metricsResult = await db
      .request()
      .input("deviceId", sql.VarChar, device.DeviceId)
      .query<{ ReceivedAt: string; CpuPct: number | null; MemPct: number | null; DiskPct: number | null }>(`
        SELECT TOP 50 ReceivedAt, CpuPct, MemPct, DiskPct
        FROM DeviceMetrics WHERE DeviceId = @deviceId ORDER BY ReceivedAt DESC
      `);
    metrics = metricsResult.recordset
      .map((r) => ({ t: r.ReceivedAt, cpu: r.CpuPct, mem: r.MemPct, disk: r.DiskPct }))
      .reverse();
  }

  const routerClientResult = await db
    .request()
    .input("ip", sql.VarChar, ip)
    .query<{
      MacAddress: string | null;
      Hostname: string | null;
      Status: string | null;
      LastSeenRaw: string | null;
      ExpiresAfterRaw: string | null;
    }>("SELECT MacAddress, Hostname, Status, LastSeenRaw, ExpiresAfterRaw FROM RouterClients WHERE IpAddress = @ip");
  const lease = routerClientResult.recordset[0] ?? null;

  const threatResult = await db
    .request()
    .input("ip", sql.VarChar, ip)
    .input("hours", sql.Int, hours)
    .query<{ ReceivedAt: string; LogType: string | null; LogSubtype: string | null; Status: string | null; Severity: string | null; SrcIp: string | null; DstIp: string | null }>(`
      SELECT TOP 50 ReceivedAt, LogType, LogSubtype, Status, Severity, SrcIp, DstIp
      FROM SophosThreatLogs
      WHERE (SrcIp = @ip OR DstIp = @ip) AND ReceivedAt >= DATEADD(HOUR, -@hours, SYSUTCDATETIME())
      ORDER BY ReceivedAt DESC
    `);

  const webFilterResult = await db
    .request()
    .input("ip", sql.VarChar, ip)
    .input("hours", sql.Int, hours)
    .query<{ ReceivedAt: string; Domain: string | null; Url: string | null; Category: string | null; Action: string | null }>(`
      SELECT TOP 50 ReceivedAt, Domain, Url, Category, Action
      FROM WebFilterLogs
      WHERE SrcIp = @ip AND ReceivedAt >= DATEADD(HOUR, -@hours, SYSUTCDATETIME())
      ORDER BY ReceivedAt DESC
    `);

  const blockedEvents: BlockedEvent[] = [
    ...threatResult.recordset.map((r): BlockedEvent => ({
      receivedAt: r.ReceivedAt,
      source: "threat",
      blocked: !!r.Status && BLOCKED_VALUES.includes(r.Status.toLowerCase()),
      detail: [r.LogType, r.LogSubtype, r.Status].filter(Boolean).join(" - ") || "Sophos threat log entry",
    })),
    ...webFilterResult.recordset.map((r): BlockedEvent => ({
      receivedAt: r.ReceivedAt,
      source: "webfilter",
      blocked: !!r.Action && BLOCKED_VALUES.includes(r.Action.toLowerCase()),
      detail: [r.Action, r.Category, r.Domain ?? r.Url].filter(Boolean).join(" - ") || "Web filter log entry",
    })),
  ].sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

  return NextResponse.json({
    ok: true,
    ip,
    device: device ? { deviceId: device.DeviceId, name: device.DeviceName ?? device.Hostname } : null,
    macAddress: lease?.MacAddress ?? device?.MacAddress ?? null,
    metrics,
    dhcpLease: lease
      ? { hostname: lease.Hostname, status: lease.Status, lastSeen: lease.LastSeenRaw, expiresAfter: lease.ExpiresAfterRaw }
      : null,
    blockedEvents,
  });
}
