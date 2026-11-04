import { getDb } from "./db";
import { getBandwidthQuotaBreaches } from "./bandwidthQuota";

function formatBytesShort(bytes: number): string {
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

// Server-local offset for Nepal Standard Time (UTC+5:45), fixed year-round (no DST) - same
// constant reasoning as formatUtcTimestamp.ts's own conversion, needed here because the
// off-hours-login check below has to compare against a *local* business-hours window while
// LoginActivity.CreatedAt is stored in UTC (SYSUTCDATETIME()).
const LOCAL_OFFSET_MINUTES = 345;

// Flags a successful LoginActivity row as off-hours if it falls outside this local-time
// window. Hardcoded for now rather than a configurable admin setting - a reasonable first
// cut (see the roadmap plan) that can grow into a real per-org setting later without changing
// where this lives.
const BUSINESS_HOURS_START = 6; // 06:00 local
const BUSINESS_HOURS_END = 22; // 22:00 local

export interface AlertRow {
  EventTime: string;
  Severity: string;
  Detail: string;
  // Populated only for alerts tied to a specific network host (RouterClients conflicts,
  // DeviceAlerts via the owning device's known IP) - null for WebsitePerformanceAlerts,
  // which have no endpoint/network-host concept at all. The UI uses this to decide whether
  // a row can open the network drill-down panel (see DeviceDrilldownTrigger).
  Ip: string | null;
}

// MikroTik warnings/errors (login failures, ARP/IP conflicts) plus current DHCP conflicts,
// most recent first. Shared by the Overview page's Recent Alerts table and the Header's
// notification bell so both always agree on what counts as an alert.
export async function getRecentAlerts(limit = 10): Promise<AlertRow[]> {
  const db = await getDb();
  const cap = Number(limit) || 10;
  const [result, quotaBreaches] = await Promise.all([
    db.query<AlertRow>(`
    SELECT TOP ${cap} EventTime, Severity, Detail, Ip FROM (
      SELECT UpdatedAt AS EventTime, 'warning' AS Severity,
        'IP conflict on ' + IpAddress + ' (' + ISNULL(MacAddress, 'unknown MAC') + ')' AS Detail,
        IpAddress AS Ip
      FROM RouterClients
      WHERE Status = 'conflict'
      UNION ALL
      SELECT da.TriggeredAt AS EventTime, da.Severity,
        d.Hostname + ': ' + da.Message AS Detail,
        COALESCE(d.StaticIpAddress, d.LastIp) AS Ip
      FROM DeviceAlerts da
      JOIN Devices d ON d.DeviceId = da.DeviceId
      WHERE da.ResolvedAt IS NULL
        -- Point-in-time alerts (e.g. usb_insert/usb_removal) are marked resolved the
        -- instant they're raised - there's no "condition cleared" to wait for - so they'd
        -- never show up under the ResolvedAt IS NULL rule above. Surface them for a while
        -- by recency instead.
        OR (da.AlertType IN ('usb_insert', 'usb_removal') AND da.TriggeredAt >= DATEADD(HOUR, -24, SYSUTCDATETIME()))
      UNION ALL
      SELECT wpa.TriggeredAt AS EventTime, wpa.Severity,
        w.Name + ': ' + wpa.Detail AS Detail,
        NULL AS Ip
      FROM WebsitePerformanceAlerts wpa
      JOIN Websites w ON w.Id = wpa.WebsiteId
      WHERE wpa.ResolvedAt IS NULL
      UNION ALL
      -- Off-hours admin login: LoginActivity has no Devices/DeviceId concept (it's dashboard
      -- sign-ins, not endpoint activity), so this reads it directly rather than going through
      -- DeviceAlerts - see the comment at the top of this file for the business-hours window.
      SELECT la.CreatedAt AS EventTime, 'warning' AS Severity,
        'Off-hours login: ' + la.Username + ' at ' +
          CONVERT(VARCHAR(19), DATEADD(MINUTE, ${LOCAL_OFFSET_MINUTES}, la.CreatedAt), 120) + ' (local)' AS Detail,
        la.IpAddress AS Ip
      FROM LoginActivity la
      WHERE la.Success = 1
        AND la.CreatedAt >= DATEADD(HOUR, -24, SYSUTCDATETIME())
        AND (
          DATEPART(HOUR, DATEADD(MINUTE, ${LOCAL_OFFSET_MINUTES}, la.CreatedAt)) < ${BUSINESS_HOURS_START}
          OR DATEPART(HOUR, DATEADD(MINUTE, ${LOCAL_OFFSET_MINUTES}, la.CreatedAt)) >= ${BUSINESS_HOURS_END}
        )
    ) alerts
    ORDER BY EventTime DESC
  `),
    getBandwidthQuotaBreaches(24),
  ]);

  const quotaRows: AlertRow[] = quotaBreaches.map((b) => ({
    EventTime: new Date().toISOString(),
    Severity: "warning",
    Detail: `${b.name} used ${formatBytesShort(b.totalBytes)} in the last 24h (cap ${formatBytesShort(b.capBytes)}) - monitoring only, not blocked`,
    Ip: b.ipAddresses[0] ?? null,
  }));

  return [...quotaRows, ...result.recordset].slice(0, cap);
}

// Same union as getRecentAlerts, but for the standalone Alert History page rather than the
// live bell dropdown: a much wider lookback window (days, not a fixed 24h) and a higher cap,
// so admins can actually page back through what fired last week/month rather than only the
// latest 20. Kept as a separate function rather than adding parameters to getRecentAlerts,
// since the bell/Overview callers need to stay on their current fixed 24h/limit-10 behavior.
export async function getAlertHistory(days: number, limit: number): Promise<AlertRow[]> {
  const db = await getDb();
  const sinceHours = Math.max(1, Math.round(days * 24));
  const cappedLimit = Math.min(Math.max(1, limit), 1000);
  const [result, quotaBreaches] = await Promise.all([
    db.query<AlertRow>(`
    SELECT TOP ${cappedLimit} EventTime, Severity, Detail, Ip FROM (
      SELECT UpdatedAt AS EventTime, 'warning' AS Severity,
        'IP conflict on ' + IpAddress + ' (' + ISNULL(MacAddress, 'unknown MAC') + ')' AS Detail,
        IpAddress AS Ip
      FROM RouterClients
      WHERE Status = 'conflict' AND UpdatedAt >= DATEADD(HOUR, -${sinceHours}, SYSUTCDATETIME())
      UNION ALL
      SELECT da.TriggeredAt AS EventTime, da.Severity,
        d.Hostname + ': ' + da.Message AS Detail,
        COALESCE(d.StaticIpAddress, d.LastIp) AS Ip
      FROM DeviceAlerts da
      JOIN Devices d ON d.DeviceId = da.DeviceId
      WHERE da.TriggeredAt >= DATEADD(HOUR, -${sinceHours}, SYSUTCDATETIME())
      UNION ALL
      SELECT wpa.TriggeredAt AS EventTime, wpa.Severity,
        w.Name + ': ' + wpa.Detail AS Detail,
        NULL AS Ip
      FROM WebsitePerformanceAlerts wpa
      JOIN Websites w ON w.Id = wpa.WebsiteId
      WHERE wpa.TriggeredAt >= DATEADD(HOUR, -${sinceHours}, SYSUTCDATETIME())
      UNION ALL
      SELECT la.CreatedAt AS EventTime, 'warning' AS Severity,
        'Off-hours login: ' + la.Username + ' at ' +
          CONVERT(VARCHAR(19), DATEADD(MINUTE, ${LOCAL_OFFSET_MINUTES}, la.CreatedAt), 120) + ' (local)' AS Detail,
        la.IpAddress AS Ip
      FROM LoginActivity la
      WHERE la.Success = 1
        AND la.CreatedAt >= DATEADD(HOUR, -${sinceHours}, SYSUTCDATETIME())
        AND (
          DATEPART(HOUR, DATEADD(MINUTE, ${LOCAL_OFFSET_MINUTES}, la.CreatedAt)) < ${BUSINESS_HOURS_START}
          OR DATEPART(HOUR, DATEADD(MINUTE, ${LOCAL_OFFSET_MINUTES}, la.CreatedAt)) >= ${BUSINESS_HOURS_END}
        )
    ) alerts
    ORDER BY EventTime DESC
  `),
    getBandwidthQuotaBreaches(24),
  ]);

  const quotaRows: AlertRow[] = quotaBreaches.map((b) => ({
    EventTime: new Date().toISOString(),
    Severity: "warning",
    Detail: `${b.name} used ${formatBytesShort(b.totalBytes)} in the last 24h (cap ${formatBytesShort(b.capBytes)}) - monitoring only, not blocked`,
    Ip: b.ipAddresses[0] ?? null,
  }));

  return [...quotaRows, ...result.recordset].slice(0, cappedLimit);
}
