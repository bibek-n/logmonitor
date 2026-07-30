import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const mon = await requireMonitoringPermission("mon_view");
  if (!isMonitoringSession(mon)) return mon;

  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const db = await getDb();

  const countResult = await db.query<{ Total: number }>("SELECT COUNT(*) AS Total FROM NotificationLogs");
  const result = await db
    .request()
    .input("offset", sql.Int, (page - 1) * PAGE_SIZE)
    .input("limit", sql.Int, PAGE_SIZE)
    .query(`
      SELECT n.Id, n.EventType, m.Name AS MonitorName, n.IncidentId, ac.Destination AS Recipient, n.Subject, n.Provider,
        n.Status, CONVERT(VARCHAR(19), n.SentAt, 126) AS SentAt, n.FailureReason, CONVERT(VARCHAR(19), n.CreatedAt, 126) AS CreatedAt,
        n.RetryCount, CONVERT(VARCHAR(19), n.NextRetryAt, 126) AS NextRetryAt,
        CASE WHEN n.Status = 'Failed' AND n.AlertContactId IS NOT NULL AND n.Body IS NOT NULL THEN 1 ELSE 0 END AS CanRetry
      FROM NotificationLogs n
      LEFT JOIN Monitors m ON m.Id = n.MonitorId
      LEFT JOIN AlertContacts ac ON ac.Id = n.AlertContactId
      ORDER BY n.CreatedAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

  return NextResponse.json({ ok: true, data: result.recordset, total: countResult.recordset[0].Total, page, pageSize: PAGE_SIZE });
}
