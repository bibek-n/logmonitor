import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";

interface AssignmentRow {
  RunCaseId: number;
  TestRunId: number;
  TestRunNumber: string;
  TestRunName: string;
  TestCaseId: number;
  TestCaseNumber: string;
  Title: string;
  Priority: string;
  LatestResult: string | null;
}

// Spec's "Get assigned test cases" endpoint for the tester-facing Execute Test screen
// (Phase 4) — every QaTestRunCase assigned to the calling user, across all non-completed
// runs, with each case's latest execution result so the UI can show what's left to do.
export async function GET(_req: NextRequest) {
  const qa = await requireQaPermission("qa_execute");
  if (!isQaSession(qa)) return qa;

  const db = await getDb();
  const result = await db.request().input("userId", sql.Int, qa.userId).query<AssignmentRow>(`
    SELECT rc.Id AS RunCaseId, r.Id AS TestRunId, r.TestRunNumber, r.Name AS TestRunName,
      tc.Id AS TestCaseId, tc.TestCaseNumber, tc.Title, tc.Priority,
      latest.Result AS LatestResult
    FROM QaTestRunCases rc
    JOIN QaTestRuns r ON r.Id = rc.TestRunId
    JOIN QaTestCases tc ON tc.Id = rc.TestCaseId
    OUTER APPLY (
      SELECT TOP 1 e.Result FROM QaTestExecutions e
      WHERE e.TestRunCaseId = rc.Id ORDER BY e.ExecutedAt DESC
    ) latest
    WHERE rc.AssignedUserId = @userId AND r.Status NOT IN ('Completed', 'Cancelled')
    ORDER BY r.CreatedAt DESC, tc.TestCaseNumber ASC
  `);

  return NextResponse.json({ ok: true, data: result.recordset });
}
