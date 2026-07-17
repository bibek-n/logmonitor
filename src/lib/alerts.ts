import { getDb } from "./db";

export interface AlertRow {
  EventTime: string;
  Severity: string;
  Detail: string;
}

// MikroTik warnings/errors (login failures, ARP/IP conflicts) plus current DHCP conflicts,
// most recent first. Shared by the Overview page's Recent Alerts table and the Header's
// notification bell so both always agree on what counts as an alert.
export async function getRecentAlerts(limit = 10): Promise<AlertRow[]> {
  const db = await getDb();
  const result = await db.query<AlertRow>(`
    SELECT TOP ${Number(limit) || 10} EventTime, Severity, Detail FROM (
      SELECT UpdatedAt AS EventTime, 'warning' AS Severity,
        'IP conflict on ' + IpAddress + ' (' + ISNULL(MacAddress, 'unknown MAC') + ')' AS Detail
      FROM RouterClients
      WHERE Status = 'conflict'
      UNION ALL
      SELECT da.TriggeredAt AS EventTime, da.Severity,
        d.Hostname + ': ' + da.Message AS Detail
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
        w.Name + ': ' + wpa.Detail AS Detail
      FROM WebsitePerformanceAlerts wpa
      JOIN Websites w ON w.Id = wpa.WebsiteId
      WHERE wpa.ResolvedAt IS NULL
    ) alerts
    ORDER BY EventTime DESC
  `);
  return result.recordset;
}
