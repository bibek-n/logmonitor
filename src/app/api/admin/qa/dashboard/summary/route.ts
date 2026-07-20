import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";

// Top-line KPIs for the QA Dashboard landing page (Phase 4). One request per widget, matching
// the spec's explicit per-KPI endpoint list, rather than one giant aggregate query — same
// per-chart-endpoint shape used by src/app/dashboard/page.tsx's existing dashboard widgets.
export async function GET(req: NextRequest) {
  const qa = await requireQaPermission("qa_view_reports");
  if (!isQaSession(qa)) return qa;

  const projectIdParam = req.nextUrl.searchParams.get("projectId");
  const projectId = projectIdParam ? Number(projectIdParam) : null;
  if (projectIdParam && !Number.isInteger(projectId)) {
    return NextResponse.json({ ok: false, error: "Invalid projectId." }, { status: 400 });
  }
  const projectFilter = projectId ? "AND ProjectId = @projectId" : "";

  const db = await getDb();
  const bind = (request: ReturnType<typeof db.request>) => (projectId ? request.input("projectId", sql.Int, projectId) : request);

  const [testCases, testSuites, testRuns, activeRuns, openBugs, passRate] = await Promise.all([
    bind(db.request()).query<{ Cnt: number }>(`SELECT COUNT(*) AS Cnt FROM QaTestCases WHERE Status <> 'Archived' ${projectFilter}`),
    bind(db.request()).query<{ Cnt: number }>(`SELECT COUNT(*) AS Cnt FROM QaTestSuites WHERE Status <> 'Archived' ${projectFilter}`),
    bind(db.request()).query<{ Cnt: number }>(`SELECT COUNT(*) AS Cnt FROM QaTestRuns WHERE 1=1 ${projectFilter}`),
    bind(db.request()).query<{ Cnt: number }>(`SELECT COUNT(*) AS Cnt FROM QaTestRuns WHERE Status = 'In Progress' ${projectFilter}`),
    bind(db.request()).query<{ Cnt: number }>(
      `SELECT COUNT(*) AS Cnt FROM QaBugs WHERE Status NOT IN ('Closed', 'Rejected', 'Duplicate') ${projectFilter}`
    ),
    bind(db.request()).query<{ Passed: number; Total: number }>(`
      SELECT
        SUM(CASE WHEN latest.Result = 'Passed' THEN 1 ELSE 0 END) AS Passed,
        COUNT(*) AS Total
      FROM QaTestRunCases rc
      JOIN QaTestRuns r ON r.Id = rc.TestRunId
      OUTER APPLY (
        SELECT TOP 1 e.Result FROM QaTestExecutions e WHERE e.TestRunCaseId = rc.Id ORDER BY e.ExecutedAt DESC
      ) latest
      WHERE latest.Result IS NOT NULL ${projectFilter.replace("ProjectId", "r.ProjectId")}
    `),
  ]);

  const passed = passRate.recordset[0]?.Passed ?? 0;
  const totalExecuted = passRate.recordset[0]?.Total ?? 0;

  return NextResponse.json({
    ok: true,
    data: {
      totalTestCases: testCases.recordset[0]?.Cnt ?? 0,
      totalTestSuites: testSuites.recordset[0]?.Cnt ?? 0,
      totalTestRuns: testRuns.recordset[0]?.Cnt ?? 0,
      activeTestRuns: activeRuns.recordset[0]?.Cnt ?? 0,
      openBugs: openBugs.recordset[0]?.Cnt ?? 0,
      passRatePercent: totalExecuted > 0 ? Math.round((passed / totalExecuted) * 1000) / 10 : null,
      executedCaseCount: totalExecuted,
    },
  });
}
