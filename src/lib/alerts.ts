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
      SELECT ReceivedAt AS EventTime, Severity, Message AS Detail
      FROM RouterLogs
      WHERE Severity IN ('warning', 'error', 'critical', 'alert', 'emergency')
      UNION ALL
      SELECT UpdatedAt AS EventTime, 'warning' AS Severity,
        'IP conflict on ' + IpAddress + ' (' + ISNULL(MacAddress, 'unknown MAC') + ')' AS Detail
      FROM RouterClients
      WHERE Status = 'conflict'
    ) alerts
    ORDER BY EventTime DESC
  `);
  return result.recordset;
}
