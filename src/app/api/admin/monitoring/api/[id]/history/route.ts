import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_view");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const db = await getDb();

  const countResult = await db.request().input("id", sql.Int, Number(id)).query<{ Total: number }>("SELECT COUNT(*) AS Total FROM MonitorResults WHERE MonitorId = @id");
  const result = await db
    .request()
    .input("id", sql.Int, Number(id))
    .input("offset", sql.Int, (page - 1) * PAGE_SIZE)
    .input("limit", sql.Int, PAGE_SIZE)
    // CheckedAt selected as raw DATETIME2 - see the identical fix and comment in
    // websiteApiMonitoring/repository.ts's JOIN_SELECT.
    .query(`
      SELECT Id, CheckedAt, Success, HttpStatusCode, DnsMs, TcpMs, TlsMs, TtfbMs,
        TotalMs, ResponseSizeBytes, RedirectCount, FinalUrl, AssertionResultsJson, ErrorCode, ErrorMessage
      FROM MonitorResults
      WHERE MonitorId = @id
      ORDER BY CheckedAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

  return NextResponse.json({ ok: true, data: result.recordset, total: countResult.recordset[0].Total, page, pageSize: PAGE_SIZE });
}
