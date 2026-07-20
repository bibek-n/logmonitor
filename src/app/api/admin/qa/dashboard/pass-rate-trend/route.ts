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
  const result = await db.request().input("days", sql.Int, days).query<{ ExecutionDate: string; Passed: number; Total: number }>(`
    SELECT
      CONVERT(VARCHAR(10), ExecutedAt, 126) AS ExecutionDate,
      SUM(CASE WHEN Result = 'Passed' THEN 1 ELSE 0 END) AS Passed,
      COUNT(*) AS Total
    FROM QaTestExecutions
    WHERE ExecutedAt >= DATEADD(DAY, -@days, SYSUTCDATETIME())
    GROUP BY CONVERT(VARCHAR(10), ExecutedAt, 126)
    ORDER BY ExecutionDate ASC
  `);

  const data = result.recordset.map((r) => ({
    date: r.ExecutionDate,
    total: r.Total,
    passed: r.Passed,
    passRatePercent: r.Total > 0 ? Math.round((r.Passed / r.Total) * 1000) / 10 : 0,
  }));

  return NextResponse.json({ ok: true, data });
}
