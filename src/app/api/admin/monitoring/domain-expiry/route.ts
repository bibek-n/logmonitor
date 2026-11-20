import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";

export async function GET() {
  const mon = await requireMonitoringPermission("mon_ssl_view");
  if (!isMonitoringSession(mon)) return mon;

  const db = await getDb();
  const result = await db.query(`
    SELECT m.Id AS MonitorId, m.Name AS MonitorName, d.Domain, CONVERT(VARCHAR(33), d.ExpiresAt, 126) AS ExpiresAt,
      DATEDIFF(DAY, SYSUTCDATETIME(), d.ExpiresAt) AS DaysRemaining,
      CONVERT(VARCHAR(33), d.LastCheckedAt, 126) AS LastCheckedAt
    FROM DomainExpiryRecords d
    JOIN Monitors m ON m.Id = d.MonitorId AND m.IsDeleted = 0
    WHERE d.ExpiresAt IS NOT NULL
    ORDER BY d.ExpiresAt ASC
  `);

  return NextResponse.json({ ok: true, data: result.recordset });
}
