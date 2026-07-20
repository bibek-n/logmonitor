import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";

export async function GET(req: NextRequest) {
  const qa = await requireQaPermission("qa_view_reports");
  if (!isQaSession(qa)) return qa;

  const runId = Number(req.nextUrl.searchParams.get("runId"));
  if (!Number.isInteger(runId)) {
    return NextResponse.json({ ok: false, error: "A valid runId query param is required." }, { status: 400 });
  }

  const db = await getDb();
  const runCheck = await db.request().input("id", sql.Int, runId).query<{ Id: number }>("SELECT Id FROM QaTestRuns WHERE Id = @id");
  if (!runCheck.recordset[0]) {
    return NextResponse.json({ ok: false, error: "Test run not found." }, { status: 404 });
  }

  const result = await db.request().input("id", sql.Int, runId).query<{ Result: string; Cnt: number }>(`
    SELECT COALESCE(latest.Result, 'Not Run') AS Result, COUNT(*) AS Cnt
    FROM QaTestRunCases rc
    OUTER APPLY (
      SELECT TOP 1 e.Result FROM QaTestExecutions e WHERE e.TestRunCaseId = rc.Id ORDER BY e.ExecutedAt DESC
    ) latest
    WHERE rc.TestRunId = @id
    GROUP BY latest.Result
  `);

  return NextResponse.json({ ok: true, data: result.recordset });
}
