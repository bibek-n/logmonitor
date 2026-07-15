import { getTranslations } from "next-intl/server";
import { getDb, sql } from "@/lib/db";
import { kbitsToMbps } from "@/components/BandwidthChart";
import { getStaffWithStatus } from "@/lib/staffStatus";
import { getRecentAlerts } from "@/lib/alerts";
import { getMyIpSummary, type MyIpSummary } from "@/lib/ipTools";
import { getTrafficByCountry, type CountryTraffic } from "@/lib/trafficByCountry";
import { getThreatSummary, type ThreatSummary } from "@/lib/threatSummary";
import { getWeatherSummary, getNepalCitiesWeather, getSwedenWeather, type WeatherSummary } from "@/lib/weather";
import { KpiCard, type KpiStatus } from "@/components/dashboard/KpiCard";
import { BandwidthPanel, type BandwidthDatum, type BandwidthRange } from "@/components/dashboard/BandwidthPanel";
import { DeviceStatusRow } from "@/components/dashboard/DeviceStatusRow";
import { AlertsTable } from "@/components/dashboard/AlertsTable";
import { ActivityTimeline, type TimelineEvent } from "@/components/dashboard/ActivityTimeline";
import { RightRail } from "@/components/dashboard/RightRail";
import { TopOverviewBar } from "@/components/dashboard/TopOverviewBar";
import { NepaliCalendarCard } from "@/components/dashboard/NepaliCalendarCard";
import { Cpu, MemoryStick, HardDrive, Globe, Wifi, Laptop, Router } from "lucide-react";

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

// Infrastructure IPs that generate their own heavy WebFilterLogs traffic and would
// otherwise dominate "Top Active Devices" forever - not an employee's device, so excluded
// from that widget. 192.168.1.7 is the Sophos firewall/gateway appliance itself (confirmed
// via its VMware-VM MAC prefix and its DeviceName always logging as "TULIP-TECHNOLOGIES",
// never a person's PC, with no MikroTik lease or Staff match at all).
const TOP_DEVICES_EXCLUDED_IPS = ["192.168.1.7"];

export default async function DashboardHome() {
  const t = await getTranslations("dashboardHome");
  const db = await getDb();

  // Everything the page needs — 13 DB queries, staff status, conflicts, alerts, and all 6
  // external lookups (weather x3, IP, traffic-by-country, threats) — runs in ONE parallel
  // batch. This used to be 3 sequential stages plus 5 sequentially-awaited external calls
  // (each with its own timeout up to ~10-12s); with dynamic="force-dynamic" re-running this
  // on every request, that serialization was the dominant cause of a slow page load. Each
  // external lookup keeps its own `.catch()` fallback so one slow/down upstream service
  // still can't block or crash the rest of the page.
  const [
    cpuHistoryRes,
    memHistoryRes,
    diskHistoryRes,
    ifaceRes,
    routerRes,
    routerClientsRes,
    bandwidthRes,
    speedTestRes,
    uptimeRes,
    topDevicesRes,
    sophosNameByIpRes,
    intranetHistoryRes,
    staff,
    conflictRes,
    alerts,
    myIp,
    trafficByCountry,
    threatSummary,
    weather,
    nepalCitiesWeather,
    swedenWeather,
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
    db.query<{ Last24h: number; ErrorsLast24h: number }>(`
      SELECT
        (SELECT COUNT(*) FROM RouterLogs WHERE ReceivedAt >= DATEADD(HOUR, -24, SYSUTCDATETIME())) AS Last24h,
        (SELECT COUNT(*) FROM RouterLogs WHERE ReceivedAt >= DATEADD(HOUR, -24, SYSUTCDATETIME()) AND Severity IN ('error', 'critical', 'alert', 'emergency')) AS ErrorsLast24h
    `),
    // Combines both network sources (MikroTik RouterClients + Sophos ARP-walk
    // SophosClients), deduped by MAC — a device connected via one network wouldn't be
    // counted at all if we only looked at the other, and this app tracks two distinct
    // client populations (192.168.20.x router-side vs 192.168.1.x Sophos LAN). Neither
    // poller ever revisits/deletes a lease once it drops off, so filtering by recent
    // UpdatedAt (90s = 3x the 30s poll interval) is what actually reflects "connected
    // right now" rather than a slowly-growing historical tally.
    db.query<{ ConnectedNow: number; TotalKnown: number }>(`
      SELECT
        (SELECT COUNT(*) FROM (
          SELECT UPPER(MacAddress) AS Mac FROM RouterClients
            WHERE MacAddress IS NOT NULL AND Status = 'bound' AND UpdatedAt >= DATEADD(SECOND, -90, SYSUTCDATETIME())
          UNION
          SELECT UPPER(MacAddress) AS Mac FROM SophosClients
            WHERE MacAddress IS NOT NULL AND UpdatedAt >= DATEADD(SECOND, -90, SYSUTCDATETIME())
        ) live) AS ConnectedNow,
        (SELECT COUNT(*) FROM (
          SELECT UPPER(MacAddress) AS Mac FROM RouterClients WHERE MacAddress IS NOT NULL
          UNION
          SELECT UPPER(MacAddress) AS Mac FROM SophosClients WHERE MacAddress IS NOT NULL
        ) known) AS TotalKnown
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
    // 4h rolling window (not 24h) so a device that's actually gone quiet drops out of the
    // list within a few hours instead of lingering on yesterday's activity all day. Infra
    // IPs (see TOP_DEVICES_EXCLUDED_IPS) are excluded so the firewall's own traffic doesn't
    // permanently occupy the list.
    db.query<{ SrcIp: string; EventCount: number }>(`
      SELECT TOP 10 SrcIp, COUNT(*) AS EventCount
      FROM WebFilterLogs
      WHERE ReceivedAt >= DATEADD(HOUR, -4, SYSUTCDATETIME()) AND SrcIp IS NOT NULL
        AND SrcIp NOT IN (${TOP_DEVICES_EXCLUDED_IPS.map((ip) => `'${ip}'`).join(", ")})
      GROUP BY SrcIp
      ORDER BY COUNT(*) DESC
    `),
    // WebFilterLogs' SrcIp values always come from the Sophos-side network (192.168.1.x),
    // which is a different address space than MikroTik's (192.168.20.x) — so resolving a
    // top-device IP to a staff name has to join against SophosClients specifically, not
    // getStaffWithStatus()'s generic currentIp (which may have resolved to the MikroTik IP
    // for a staff member whose router-side poll happened to be the most recent one).
    db.query<{ IpAddress: string; Name: string }>(`
      SELECT sc.IpAddress, s.Name
      FROM SophosClients sc
      JOIN Staff s ON UPPER(s.MacAddress) = UPPER(sc.MacAddress)
      WHERE sc.MacAddress IS NOT NULL
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
    getStaffWithStatus(),
    db.query<{ Cnt: number }>(`SELECT COUNT(*) AS Cnt FROM RouterClients WHERE Status = 'conflict'`),
    getRecentAlerts(10),
    getMyIpSummary().catch((): MyIpSummary | null => null),
    getTrafficByCountry().catch((): CountryTraffic[] => []),
    getThreatSummary().catch((): ThreatSummary => ({ blocked24h: 0, critical24h: 0 })),
    getWeatherSummary().catch((): WeatherSummary | null => null),
    getNepalCitiesWeather().catch((): WeatherSummary[] => []),
    getSwedenWeather().catch((): WeatherSummary | null => null),
  ]);

  const staffOnline = staff.filter((s) => s.isOnline).length;
  const staffUnassigned = staff.filter((s) => !s.MacAddress).length;
  const staffOffline = staff.length - staffOnline - staffUnassigned;
  const staffStale = staff.filter(
    (s) => s.MacAddress && (!s.lastSeen || Date.now() - s.lastSeen.getTime() > 24 * 3600 * 1000)
  ).length;

  const conflictCount = conflictRes.recordset[0]?.Cnt ?? 0;
  const attentionCount = conflictCount + staffStale;

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

  // Below 1 Mbps, rendering at a fixed 1-decimal Mbps rounds real (but small) traffic down
  // to "0.0" — visually indistinguishable from no data at all. Port1/Intranet in particular
  // is a low-traffic LAN uplink that usually sits well under 1 Mbps, so this switches to
  // Kbps for small values instead of silently rounding them away.
  function formatRate(mbps: number): string {
    if (mbps < 1) return `${(mbps * 1000).toFixed(1)} Kbps`;
    return `${mbps.toFixed(1)} Mbps`;
  }

  function interfaceKpi(port: string, label: string, icon: typeof Globe) {
    const entry = ifaceByName.get(port);
    const stale = isStale(entry?.receivedAt);
    const status: KpiStatus = !entry ? "unknown" : stale ? "critical" : "good";
    const rx = entry?.fields.receivedkbits ? kbitsToMbps(Number(entry.fields.receivedkbits)) : null;
    const tx = entry?.fields.transmittedkbits ? kbitsToMbps(Number(entry.fields.transmittedkbits)) : null;
    const value = rx !== null && tx !== null ? `${formatRate(rx)} / ${formatRate(tx)}` : t("noData");
    return { label, icon, value, sub: stale ? t("noRecentData") : t("rxTxLatest"), status };
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

  // --- Router events / Router clients ---
  const routerStats = routerRes.recordset[0];
  const routerStatus: KpiStatus = (routerStats?.ErrorsLast24h ?? 0) > 0 ? "warning" : "good";
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

  // sophosNameByIp first (WebFilterLogs' SrcIp is always a Sophos-side IP), falling back to
  // the generic currentIp map for the rare case a staff row has no SophosClients entry at all.
  const sophosNameByIp = new Map(sophosNameByIpRes.recordset.map((r) => [r.IpAddress, r.Name]));
  const staffByIp = new Map(staff.filter((s) => s.currentIp).map((s) => [s.currentIp as string, s.Name]));
  const topDevices = topDevicesRes.recordset.map((r) => ({
    ip: r.SrcIp,
    name: sophosNameByIp.get(r.SrcIp) ?? staffByIp.get(r.SrcIp) ?? null,
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
        label: t("deviceFirstSeen", { name: s.Name }),
        kind: (s.isOnline ? "staff-online" : "staff-offline") as TimelineEvent["kind"],
      })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 8);

  const intranetKpi = interfaceKpi("Port1", t("intranetLabel"), Router);
  const wlanKpi = interfaceKpi("Port2", t("wlanLabel"), Wifi);

  return (
    <div className="mx-auto" style={{ width: "100%" }}>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>{t("title")}</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        {t("subtitle")}
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6 mb-6">
        <NepaliCalendarCard />
        <TopOverviewBar weather={weather} nepalCitiesWeather={nepalCitiesWeather} swedenWeather={swedenWeather} />
      </div>

      <div className="grid gap-6 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <KpiCard
          icon={Cpu}
          title={t("cpuUsage")}
          value={cpuUsage !== null ? `${cpuUsage.toFixed(1)}%` : t("noData")}
          sub={latestCpuFields.system ? t("systemUserSub", { system: latestCpuFields.system, user: latestCpuFields.user }) : undefined}
          status={cpuStatus}
          trendPct={trendPct(cpuUsage, cpuPrev)}
          sparkline={cpuHistory.map((value) => ({ value }))}
        />
        <KpiCard
          icon={MemoryStick}
          title={t("memoryUsage")}
          value={memUsed !== null && memTotal !== null ? `${memUsed.toFixed(1)} / ${memTotal.toFixed(1)} GB` : t("noData")}
          sub={memPct !== null ? t("pctUsed", { pct: memPct.toFixed(1) }) : undefined}
          status={memStatus}
          trendPct={trendPct(memPct, memPrev)}
          sparkline={memHistory.map((value) => ({ value }))}
        />
        <KpiCard
          icon={HardDrive}
          title={t("diskUsage")}
          value={worstDiskPctNow !== null ? `${worstDiskPctNow.toFixed(0)}%` : t("noData")}
          sub={worstDiskEntry?.name}
          status={diskStatus}
          trendPct={trendPct(worstDiskPctNow, diskPrev)}
          sparkline={diskHistory.map((value) => ({ value }))}
        />
        <KpiCard
          icon={wlanKpi.icon}
          title={t("usageTitle", { label: wlanKpi.label })}
          value={wlanKpi.value}
          sub={wlanKpi.sub}
          status={wlanKpi.status}
          sparkline={bandwidthData["24H"].map((p) => ({ value: p.rx + p.tx }))}
        />
        <KpiCard
          icon={intranetKpi.icon}
          title={t("usageTitle", { label: intranetKpi.label })}
          value={intranetKpi.value}
          sub={intranetKpi.sub}
          status={intranetKpi.status}
          sparkline={intranetSparkline}
        />
        <KpiCard
          icon={Laptop}
          title={t("connectedDevices")}
          value={`${routerClientsStats?.ConnectedNow ?? 0}`}
          sub={t("knownDevicesTotal", { count: routerClientsStats?.TotalKnown ?? 0 })}
          status={routerStatus}
        />
      </div>

      <div className="mb-6">
        <BandwidthPanel data={bandwidthData} sparseRanges={["7D", "30D"]} />
      </div>

      <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>{t("deviceStatusTitle")}</h2>
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
          trafficByCountry={trafficByCountry}
          threatSummary={threatSummary}
        />
      </div>
    </div>
  );
}
