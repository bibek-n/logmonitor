import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";

// Requirement Traceability Matrix: for a project, every requirement + its linked test cases +
// each case's latest execution result (across any run it has appeared in), so a reviewer can
// see coverage at a glance. Read in full, not paginated — matrices are meant to be scanned
// whole, matching how QaTable's callers elsewhere page long lists but a matrix report doesn't.
export async function GET(req: NextRequest) {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const sp = req.nextUrl.searchParams;
  const projectId = Number(sp.get("projectId"));
  if (!Number.isInteger(projectId)) {
    return NextResponse.json({ ok: false, error: "A valid projectId is required." }, { status: 400 });
  }

  const db = await getDb();

  const requirements = await db.request().input("projectId", sql.Int, projectId).query<{
    Id: number; RequirementNumber: string; Title: string; Priority: string; Status: string;
  }>(`
    SELECT Id, RequirementNumber, Title, Priority, Status FROM QaRequirements
    WHERE ProjectId = @projectId ORDER BY RequirementNumber ASC
  `);

  const links = await db.request().input("projectId", sql.Int, projectId).query<{
    RequirementId: number; TestCaseId: number; TestCaseNumber: string; TestCaseTitle: string; LatestResult: string | null;
  }>(`
    SELECT rtc.RequirementId, tc.Id AS TestCaseId, tc.TestCaseNumber, tc.Title AS TestCaseTitle,
      latest.Result AS LatestResult
    FROM QaRequirementTestCases rtc
    JOIN QaTestCases tc ON tc.Id = rtc.TestCaseId
    JOIN QaRequirements r ON r.Id = rtc.RequirementId
    OUTER APPLY (
      SELECT TOP 1 e.Result FROM QaTestExecutions e
      JOIN QaTestRunCases rc ON rc.Id = e.TestRunCaseId
      WHERE rc.TestCaseId = tc.Id
      ORDER BY e.ExecutedAt DESC
    ) latest
    WHERE r.ProjectId = @projectId
    ORDER BY tc.TestCaseNumber ASC
  `);

  const matrix = requirements.recordset.map((r) => {
    const testCases = links.recordset.filter((l) => l.RequirementId === r.Id);
    const passed = testCases.filter((tc) => tc.LatestResult === "Passed").length;
    return {
      ...r,
      testCases: testCases.map((tc) => ({ Id: tc.TestCaseId, TestCaseNumber: tc.TestCaseNumber, Title: tc.TestCaseTitle, LatestResult: tc.LatestResult })),
      coveragePercent: testCases.length > 0 ? Math.round((passed / testCases.length) * 100) : 0,
    };
  });

  return NextResponse.json({ ok: true, data: matrix });
}
