import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";

export interface QaTestCaseHistoryRow {
  ExecutionId: number;
  Result: string;
  ActualResult: string | null;
  Notes: string | null;
  ExecutedByUserId: number | null;
  ExecutedByUsername: string | null;
  ExecutedAt: string;
  TestRunId: number;
  TestRunNumber: string;
  TestRunName: string;
}

// Every execution attempt for this test case, across every test run it's ever been part of
// — newest first. QaTestExecutions never overwrites a prior row (see migrate-qa-testing.ts),
// so this is a genuine full history, not just the latest result.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const testCaseId = Number(id);
  if (!Number.isInteger(testCaseId)) {
    return NextResponse.json({ ok: false, error: "Invalid test case id." }, { status: 400 });
  }

  const db = await getDb();

  const caseCheck = await db.request().input("id", sql.Int, testCaseId).query<{ Id: number }>(
    "SELECT Id FROM QaTestCases WHERE Id = @id"
  );
  if (!caseCheck.recordset[0]) {
    return NextResponse.json({ ok: false, error: "Test case not found." }, { status: 404 });
  }

  const result = await db.request().input("testCaseId", sql.Int, testCaseId).query<QaTestCaseHistoryRow>(`
    SELECT
      e.Id AS ExecutionId, e.Result, e.ActualResult, e.Notes,
      e.ExecutedByUserId, u.Username AS ExecutedByUsername,
      CONVERT(VARCHAR(19), e.ExecutedAt, 126) AS ExecutedAt,
      run.Id AS TestRunId, run.TestRunNumber, run.Name AS TestRunName
    FROM QaTestExecutions e
    JOIN QaTestRunCases rc ON rc.Id = e.TestRunCaseId
    JOIN QaTestRuns run ON run.Id = rc.TestRunId
    LEFT JOIN Users u ON u.Id = e.ExecutedByUserId
    WHERE rc.TestCaseId = @testCaseId
    ORDER BY e.ExecutedAt DESC
  `);

  return NextResponse.json({ ok: true, data: result.recordset });
}
