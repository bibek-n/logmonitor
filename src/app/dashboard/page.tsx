import { getDb, sql } from "@/lib/db";
import { kbitsToMbps } from "@/components/BandwidthChart";
import { getStaffWithStatus } from "@/lib/staffStatus";
import { getRecentAlerts } from "@/lib/alerts";
import { getMyIpSummary, type MyIpSummary } from "@/lib/ipTools";
import { KpiCard, type KpiStatus } from "@/components/dashboard/KpiCard";
import { BandwidthPanel, type BandwidthDatum, type BandwidthRange } from "@/components/dashboard/BandwidthPanel";
import { DeviceStatusRow } from "@/components/dashboard/DeviceStatusRow";
import { AlertsTable } from "@/components/dashboard/AlertsTable";
import { ActivityTimeline, type TimelineEvent } from "@/components/dashboard/ActivityTimeline";
import { RightRail } from "@/components/dashboard/RightRail";
import { Cpu, MemoryStick, HardDrive, Globe, Wifi, ShieldCheck, Network, Laptop, Router } from "lucide-react";

export const dynamic = "force-dynamic";

function parseJson(json: string | null): Record<string, string> {
  if (!json) return {};
  try {
    return JSON.parse(json) as Record<string, string>;
  } catch {
    return {};
  }
}

function statusFor(value: number | null, warnAt: number, criticalAt: number): KpiStatus {
  if (value === null) return "unknown";
  if (value >= criticalAt) return "critical";
  if (value >= warnAt) return "warning";
  return "good";
}

function isStale(receivedAt: string | undefined, staleMinutes = 10): boolean {
  if (!receivedAt) return true;
  return Date.now() - new Date(receivedAt).getTime() > staleMinutes * 60 * 1000;
}

function trendPct(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

const BANDWIDTH_RANGES: { key: BandwidthRange; hours: number }[] = [
  { key: "1H", hours: 1 },
  { key: "6H", hours: 6 },
  { key: "24H", hours: 24 },
  { key: "7D", hours: 24 * 7 },
  { key: "30D", hours: 24 * 30 },
];

export default async function DashboardHome() {
  const db = await getDb();

  const [
    cpuHistoryRes,
    memHistoryRes,
    diskHistoryRes,
    ifaceRes,
    webFilterRes,
    routerRes,
    routerWebRes,
    routerClientsRes,
    bandwidthRes,
    speedTestRes,
    uptimeRes,
    topDevicesRes,
    intranetHistoryRes,
  ] = await Promise.all([
    db.query<{ Fields: string | null; ReceivedAt: string }>(
      `SELECT TOP 20 Fields, ReceivedAt FROM SystemHealthLogs WHERE LogComponent = 'CPU' ORDER BY ReceivedAt DESC`
    ),
    db.query<{ Fields: string | null; ReceivedAt: string }>(
      `SELECT TOP 20 Fields, ReceivedAt FROM SystemHealthLogs WHERE LogComponent = 'Memory' ORDER BY ReceivedAt DESC`
    ),
    db.query<{ Fields: string | null; ReceivedAt: string }>(
      `SELECT TOP 20 Fields, ReceivedAt FROM SystemHealthLogs WHERE LogComponent = 'Disk' ORDER BY ReceivedAt DESC`
    ),
    db.query<{ Fields: string | null; ReceivedAt: string }>(`
      SELECT Fields, ReceivedAt FROM SystemHealthLogs
      WHERE Id IN (
        SELECT MAX(Id) FROM SystemHealthLogs
        WHERE LogComponent = 'Interface' AND JSON_VALUE(Fields, '$.interface') IN ('Port1', 'Port2')
        GROUP BY JSON_VALUE(Fields, '$.interface')
      )
    `),
    db.query<{ Last24h: number; Prior24h: number; DistinctIps: number }>(`
      SELECT
        (SELECT COUNT(*) FROM WebFilterLogs WHERE ReceivedAt >= DATEADD(HOUR, -24, SYSUTCDATETIME())) AS Last24h,
        (SELECT COUNT(*) FROM WebFilterLogs WHERE ReceivedAt >= DATEADD(HOUR, -48, SYSUTCDATETIME()) AND ReceivedAt < DATEADD(HOUR, -24, SYSUTCDATETIME())) AS Prior24h,
        (SELECT COUNT(DISTINCT SrcIp) FROM WebFilterLogs WHERE SrcIp IS NOT NULL) AS DistinctIps
    `),
    db.query<{ Last24h: number; ErrorsLast24h: number }>(`
      SELECT
        (SELECT COUNT(*) FROM RouterLogs WHERE ReceivedAt >= DATEADD(HOUR, -24, SYSUTCDATETIME())) AS Last24h,
        (SELECT COUNT(*) FROM RouterLogs WHERE ReceivedAt >= DATEADD(HOUR, -24, SYSUTCDATETIME()) AND Severity IN ('error', 'critical', 'alert', 'emergency')) AS ErrorsLast24h
    `),
    db.query<{ Total: number; Prior24h: number; DistinctIps: number }>(`
      SELECT
        (SELECT COUNT(*) FROM RouterWebLogs WHERE ReceivedAt >= DATEADD(HOUR, -24, SYSUTCDATETIME())) AS Total,
        (SELECT COUNT(*) FROM RouterWebLogs WHERE ReceivedAt >= DATEADD(HOUR, -48, SYSUTCDATETIME()) AND ReceivedAt < DATEADD(HOUR, -24, SYSUTCDATETIME())) AS Prior24h,
        (SELECT COUNT(DISTINCT SrcIp) FROM RouterWebLogs WHERE SrcIp IS NOT NULL) AS DistinctIps
    `),
    db.query<{ Total: number; Bound: number }>(`
      SELECT COUNT(*) AS Total, SUM(CASE WHEN Status = 'bound' THEN 1 ELSE 0 END) AS Bound
      FROM RouterClients
    `),
    // One query per range x per interface (Port2/WLAN is the headline chart) — capped at 500
    // rows per range so a heavily-polled window doesn't balloon the payload.
    Promise.all(
      BANDWIDTH_RANGES.map(({ hours }) =>
        db
          .request()
          .input("ifName", sql.NVarChar, "Port2")
          .input("hours", sql.Int, hours)
          .query<{ ReceivedAt: string; Rx: string | null; Tx: string | null }>(`
            SELECT TOP 500 ReceivedAt,
              JSON_VALUE(Fields, '$.receivedkbits') AS Rx,
              JSON_VALUE(Fields, '$.transmittedkbits') AS Tx
            FROM SystemHealthLogs
            WHERE LogComponent = 'Interface' AND JSON_VALUE(Fields, '$.interface') = @ifName
              AND ReceivedAt >= DATEADD(HOUR, -@hours, SYSUTCDATETIME())
            ORDER BY ReceivedAt DESC
          `)
      )
    ),
    db.query<{ PingMs: number | null; DownloadMbps: number | null; UploadMbps: number | null; CreatedAt: string }>(
      `SELECT TOP 1 PingMs, DownloadMbps, UploadMbps, CreatedAt FROM SpeedTestResults ORDER BY CreatedAt DESC`
    ),
    db.query<{ Earliest: string | null }>(`SELECT MIN(ReceivedAt) AS Earliest FROM SystemHealthLogs`),
    db.query<{ SrcIp: string; EventCount: number }>(`
      SELECT TOP 5 SrcIp, COUNT(*) AS EventCount
      FROM WebFilterLogs
      WHERE ReceivedAt >= DATEADD(HOUR, -24, SYSUTCDATETIME()) AND SrcIp IS NOT NULL
      GROUP BY SrcIp
      ORDER BY COUNT(*) DESC
    `),
    // Intranet = Sophos Port1 interface bandwidth history (for the sparkline only — the
    // live Rx/Tx value itself comes from `ifaceByName`/`interfaceKpi` below, same as CPU/
    // Memory/Disk sparklines pull their own dedicated TOP-N history).
    db.query<{ ReceivedAt: string; Rx: string | null; Tx: string | null }>(`
      SELECT TOP 20 ReceivedAt,
        JSON_VALUE(Fields, '$.receivedkbits') AS Rx,
        JSON_VALUE(Fields, '$.transmittedkbits') AS Tx
      FROM SystemHealthLogs
      WHERE LogComponent = 'Interface' AND JSON_VALUE(Fields, '$.interface') = 'Port1'
      ORDER BY ReceivedAt DESC
    `),
  ]);

  const staff = await getStaffWithStatus();
  const staffOnline = staff.filter((s) => s.isOnline).length;
  const staffUnassigned = staff.filter((s) => !s.MacAddress).length;
  const staffOffline = staff.length - staffOnline - staffUnassigned;
  const staffStale = staff.filter(
    (s) => s.MacAddress && (!s.lastSeen || Date.now() - s.lastSeen.getTime() > 24 * 3600 * 1000)
  ).length;

  const [conflictRes, alerts] = await Promise.all([
    db.query<{ Cnt: number }>(`SELECT COUNT(*) AS Cnt FROM RouterClients WHERE Status = 'conflict'`),
    getRecentAlerts(10),
  ]);
  const conflictCount = conflictRes.recordset[0]?.Cnt ?? 0;
  const attentionCount = conflictCount + staffStale;

  // External lookup — never let this block or crash the whole page if ip-api is slow/down.
  let myIp: MyIpSummary | null = null;
  try {
    myIp = await getMyIpSummary();
  } catch {
    myIp = null;
  }

  // --- CPU (history -> sparkline + trend + latest) ---
  const cpuHistory = cpuHistoryRes.recordset
    .map((r) => {
      const f = parseJson(r.Fields);
      const idle = f.idle ? Number(f.idle.replace("%", "")) : null;
      return idle !== null ? 100 - idle : null;
    })
    .filter((v): v is number => v !== null)
    .reverse();
  const cpuUsage = cpuHistory.length > 0 ? cpuHistory[cpuHistory.length - 1] : null;
  const cpuPrev = cpuHistory.length > 1 ? cpuHistory[cpuHistory.length - 2] : null;
  const cpuStatus = statusFor(cpuUsage, 70, 85);
  const latestCpuFields = parseJson(cpuHistoryRes.recordset[0]?.Fields ?? null);

  // --- Memory ---
  const memHistory = memHistoryRes.recordset
    .map((r) => {
      const f = parseJson(r.Fields);
      const total = f.total_memory ? Number(f.total_memory) : null;
      const used = f.used ? Number(f.used) : null;
      return total && used !== null ? (used / total) * 100 : null;
    })
    .filter((v): v is number => v !== null)
    .reverse();
  const memPct = memHistory.length > 0 ? memHistory[memHistory.length - 1] : null;
  const memPrev = memHistory.length > 1 ? memHistory[memHistory.length - 2] : null;
  const memStatus = statusFor(memPct, 75, 90);
  const latestMemFields = parseJson(memHistoryRes.recordset[0]?.Fields ?? null);
  const memTotal = latestMemFields.total_memory ? Number(latestMemFields.total_memory) / 1024 ** 3 : null;
  const memUsed = latestMemFields.used ? Number(latestMemFields.used) / 1024 ** 3 : null;

  // --- Disk (worst partition, per poll) ---
  function worstDiskPct(fields: Record<string, string>): number | null {
    const entries = Object.entries(fields).filter(([, v]) => v.endsWith("%"));
    if (entries.length === 0) return null;
    return Math.max(...entries.map(([, v]) => Number(v.replace("%", ""))));
  }
  const diskHistory = diskHistoryRes.recordset
    .map((r) => worstDiskPct(parseJson(r.Fields)))
    .filter((v): v is number => v !== null)
    .reverse();
  const worstDiskPctNow = diskHistory.length > 0 ? diskHistory[diskHistory.length - 1] : null;
  const diskPrev = diskHistory.length > 1 ? diskHistory[diskHistory.length - 2] : null;
  const diskStatus = statusFor(worstDiskPctNow, 75, 90);
  const latestDiskFields = parseJson(diskHistoryRes.recordset[0]?.Fields ?? null);
  const worstDiskEntry = Object.entries(latestDiskFields)
    .filter(([, v]) => v.endsWith("%"))
    .map(([k, v]) => ({ name: k, pct: Number(v.replace("%", "")) }))
    .sort((a, b) => b.pct - a.pct)[0];

  // --- Interfaces (latest + per-range history for the bandwidth chart) ---
  const ifaceByName = new Map<string, { fields: Record<string, string>; receivedAt: string }>();
  for (const row of ifaceRes.recordset) {
    const fields = parseJson(row.Fields);
    if (fields.interface) ifaceByName.set(fields.interface, { fields, receivedAt: row.ReceivedAt });
  }

  function interfaceKpi(port: string, label: string, icon: typeof Globe) {
    const entry = ifaceByName.get(port);
    const stale = isStale(entry?.receivedAt);
    const status: KpiStatus = !entry ? "unknown" : stale ? "critical" : "good";
    const rx = entry?.fields.receivedkbits ? kbitsToMbps(Number(entry.fields.receivedkbits)) : null;
    const tx = entry?.fields.transmittedkbits ? kbitsToMbps(Number(entry.fields.transmittedkbits)) : null;
    const value = rx !== null && tx !== null ? `${rx.toFixed(1)} / ${tx.toFixed(1)} Mbps` : "No data";
    return { label, icon, value, sub: stale ? "No recent data" : "Rx / Tx (latest)", status };
  }

  const bandwidthData = {} as Record<BandwidthRange, BandwidthDatum[]>;
  BANDWIDTH_RANGES.forEach(({ key }, i) => {
    bandwidthData[key] = bandwidthRes[i].recordset
      .filter((r) => r.Rx !== null && r.Tx !== null)
      .map((r) => ({ t: r.ReceivedAt, rx: kbitsToMbps(Number(r.Rx)), tx: kbitsToMbps(Number(r.Tx)) }))
      .reverse();
  });

  // --- Intranet: Sophos Port1 interface bandwidth (sparkline history only; live value
  // comes from interfaceKpi("Port1", ...) below) ---
  const intranetSparkline = intranetHistoryRes.recordset
    .filter((r) => r.Rx !== null && r.Tx !== null)
    .map((r) => ({ value: kbitsToMbps(Number(r.Rx)) + kbitsToMbps(Number(r.Tx)) }))
    .reverse();

  // --- Web Filter / Router events / Router web / Router clients ---
  const webFilterStats = webFilterRes.recordset[0];
  const routerStats = routerRes.recordset[0];
  const routerStatus: KpiStatus = (routerStats?.ErrorsLast24h ?? 0) > 0 ? "warning" : "good";
  const routerWebStats = routerWebRes.recordset[0];
  const routerClientsStats = routerClientsRes.recordset[0];

  // --- Right rail: latest speed test, monitoring uptime, top devices ---
  const latestSpeedTest = speedTestRes.recordset[0]
    ? {
        pingMs: speedTestRes.recordset[0].PingMs,
        downloadMbps: speedTestRes.recordset[0].DownloadMbps,
        uploadMbps: speedTestRes.recordset[0].UploadMbps,
        createdAt: speedTestRes.recordset[0].CreatedAt,
      }
    : null;
  const monitoringSince = uptimeRes.recordset[0]?.Earliest ?? null;

  const staffByIp = new Map(staff.filter((s) => s.currentIp).map((s) => [s.currentIp as string, s.Name]));
  const topDevices = topDevicesRes.recordset.map((r) => ({
    ip: r.SrcIp,
    name: staffByIp.get(r.SrcIp) ?? null,
    eventCount: r.EventCount,
  }));

  // --- Health score: simple, transparent composite of the same signals shown above ---
  let healthScore = 100;
  if (cpuUsage != null) healthScore -= cpuUsage > 85 ? 25 : cpuUsage > 70 ? 10 : 0;
  if (memPct != null) healthScore -= memPct > 90 ? 25 : memPct > 75 ? 10 : 0;
  if (worstDiskPctNow != null) healthScore -= worstDiskPctNow > 90 ? 20 : worstDiskPctNow > 75 ? 8 : 0;
  healthScore -= Math.min(attentionCount * 5, 20);
  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

  // --- Activity timeline: recent alerts + staff first-seen, merged and sorted ---
  const timelineEvents: TimelineEvent[] = [
    ...alerts.slice(0, 6).map((a) => ({ time: a.EventTime, label: a.Detail, kind: "alert" as const })),
    ...staff
      .filter((s) => s.firstSeen)
      .slice(0, 6)
      .map((s) => ({
        time: (s.firstSeen as Date).toISOString(),
        label: `${s.Name}'s device first seen on the network`,
        kind: (s.isOnline ? "staff-online" : "staff-offline") as TimelineEvent["kind"],
      })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 8);

  const intranetKpi = interfaceKpi("Port1", "Intranet", Router);
  const wlanKpi = interfaceKpi("Port2", "WLAN", Wifi);

  return (
    <div className="mx-auto" style={{ maxWidth: 1600 }}>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Overview</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Sophos firewall &middot; MikroTik router &middot; System health &amp; web filter monitoring
      </p>

      <div className="grid gap-6 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <KpiCard
          icon={Cpu}
          title="CPU Usage"
          value={cpuUsage !== null ? `${cpuUsage.toFixed(1)}%` : "No data"}
          sub={latestCpuFields.system ? `System ${latestCpuFields.system} · User ${latestCpuFields.user}` : undefined}
          status={cpuStatus}
          trendPct={trendPct(cpuUsage, cpuPrev)}
          sparkline={cpuHistory.map((value) => ({ value }))}
        />
        <KpiCard
          icon={MemoryStick}
          title="Memory Usage"
          value={memUsed !== null && memTotal !== null ? `${memUsed.toFixed(1)} / ${memTotal.toFixed(1)} GB` : "No data"}
          sub={memPct !== null ? `${memPct.toFixed(1)}% used` : undefined}
          status={memStatus}
          trendPct={trendPct(memPct, memPrev)}
          sparkline={memHistory.map((value) => ({ value }))}
        />
        <KpiCard
          icon={HardDrive}
          title="Disk Usage"
          value={worstDiskPctNow !== null ? `${worstDiskPctNow.toFixed(0)}%` : "No data"}
          sub={worstDiskEntry?.name}
          status={diskStatus}
          trendPct={trendPct(worstDiskPctNow, diskPrev)}
          sparkline={diskHistory.map((value) => ({ value }))}
        />
        <KpiCard
          icon={wlanKpi.icon}
          title={`${wlanKpi.label} Usage`}
          value={wlanKpi.value}
          sub={wlanKpi.sub}
          status={wlanKpi.status}
          sparkline={bandwidthData["24H"].map((p) => ({ value: p.rx + p.tx }))}
        />
        <KpiCard
          icon={intranetKpi.icon}
          title={`${intranetKpi.label} Usage`}
          value={intranetKpi.value}
          sub={intranetKpi.sub}
          status={intranetKpi.status}
          sparkline={intranetSparkline}
        />
        <KpiCard
          icon={ShieldCheck}
          title="Firewall Events"
          value={`${webFilterStats?.Last24h ?? 0}`}
          sub={`${webFilterStats?.DistinctIps ?? 0} internal IPs total (24h)`}
          status={(webFilterStats?.Last24h ?? 0) > 0 ? "good" : "unknown"}
          trendPct={trendPct(webFilterStats?.Last24h ?? null, webFilterStats?.Prior24h ?? null)}
        />
        <KpiCard
          icon={Network}
          title="Router Connections"
          value={`${routerWebStats?.Total ?? 0}`}
          sub={`${routerWebStats?.DistinctIps ?? 0} internal IPs total (24h)`}
          status={(routerWebStats?.Total ?? 0) > 0 ? "good" : "unknown"}
          trendPct={trendPct(routerWebStats?.Total ?? null, routerWebStats?.Prior24h ?? null)}
        />
        <KpiCard
          icon={Laptop}
          title="Connected Devices"
          value={`${routerClientsStats?.Total ?? 0}`}
          sub={`${routerClientsStats?.Bound ?? 0} currently bound`}
          status={routerStatus}
        />
      </div>

      <div className="mb-6">
        <BandwidthPanel data={bandwidthData} sparseRanges={["7D", "30D"]} />
      </div>

      <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Device Status</h2>
      <div className="mb-6">
        <DeviceStatusRow total={staff.length} online={staffOnline} offline={staffOffline} attention={attentionCount} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6">
        <div className="flex flex-col gap-6" style={{ minWidth: 0 }}>
          <AlertsTable alerts={alerts} />
          <ActivityTimeline events={timelineEvents} />
        </div>
        <RightRail
          healthScore={healthScore}
          ip={myIp}
          latestSpeedTest={latestSpeedTest}
          topDevices={topDevices}
          monitoringSince={monitoringSince}
          diskFreePct={worstDiskEntry ? 100 - worstDiskEntry.pct : null}
        />
      </div>
    </div>
  );
}
