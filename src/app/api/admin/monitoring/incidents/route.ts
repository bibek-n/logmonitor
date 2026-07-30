import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";

const PAGE_SIZE = 30;

export async function GET(req: NextRequest) {
  const mon = await requireMonitoringPermission("mon_incidents_view");
  if (!isMonitoringSession(mon)) return mon;

  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const status = req.nextUrl.searchParams.get("status");
  const monitorId = req.nextUrl.searchParams.get("monitorId");
  const db = await getDb();

  const request1 = db.request();
  const request2 = db.request().input("offset", sql.Int, (page - 1) * PAGE_SIZE).input("limit", sql.Int, PAGE_SIZE);
  const clauses: string[] = [];
  if (status) {
    clauses.push("i.Status = @status");
    request1.input("status", sql.VarChar, status);
    request2.input("status", sql.VarChar, status);
  }
  if (monitorId) {
    clauses.push("i.MonitorId = @monitorId");
    request1.input("monitorId", sql.Int, Number(monitorId));
    request2.input("monitorId", sql.Int, Number(monitorId));
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const countResult = await request1.query<{ Total: number }>(`SELECT COUNT(*) AS Total FROM Incidents i ${where}`);
  // StartedAt/ResolvedAt selected as raw DATETIME2 (never CONVERT(...,126) to a Z-less
  // string) - see the identical fix and comment in websiteApiMonitoring/repository.ts's
  // JOIN_SELECT.
  const result = await request2.query(`
    SELECT i.Id, i.Title, i.Severity, i.Status, i.FailureReason, i.HttpStatusCode,
      i.StartedAt, i.ResolvedAt,
      i.DowntimeSeconds, m.Name AS MonitorName, m.MonitorType
    FROM Incidents i
    JOIN Monitors m ON m.Id = i.MonitorId
    ${where}
    ORDER BY i.StartedAt DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  return NextResponse.json({ ok: true, data: result.recordset, total: countResult.recordset[0].Total, page, pageSize: PAGE_SIZE });
}
