import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 180;

export async function GET(req: NextRequest) {
  const qa = await requireQaPermission("qa_view_reports");
  if (!isQaSession(qa)) return qa;

  const daysParam = Number(req.nextUrl.searchParams.get("days"));
  const days = Number.isInteger(daysParam) && daysParam > 0 ? Math.min(daysParam, MAX_DAYS) : DEFAULT_DAYS;

  const db = await getDb();
  const result = await db.request().input("days", sql.Int, days).query<{
    UserId: number; Username: string; Executed: number; Passed: number; Failed: number;
  }>(`
    SELECT u.Id AS UserId, u.Username,
      COUNT(*) AS Executed,
      SUM(CASE WHEN e.Result = 'Passed' THEN 1 ELSE 0 END) AS Passed,
      SUM(CASE WHEN e.Result = 'Failed' THEN 1 ELSE 0 END) AS Failed
    FROM QaTestExecutions e
    JOIN Users u ON u.Id = e.ExecutedByUserId
    WHERE e.ExecutedAt >= DATEADD(DAY, -@days, SYSUTCDATETIME())
    GROUP BY u.Id, u.Username
    ORDER BY Executed DESC
  `);

  return NextResponse.json({ ok: true, data: result.recordset });
}
