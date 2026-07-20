import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";

interface RunCaseListRow {
  Id: number;
  TestRunId: number;
  TestCaseId: number;
  AssignedUserId: number | null;
  TestCaseNumber: string;
  Title: string;
  Priority: string;
  LatestResult: string | null;
  LatestExecutedAt: string | null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const runId = Number(id);
  if (!Number.isInteger(runId)) {
    return NextResponse.json({ ok: false, error: "Invalid test run id." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, runId).query<RunCaseListRow>(`
    SELECT rc.Id, rc.TestRunId, rc.TestCaseId, rc.AssignedUserId,
      tc.TestCaseNumber, tc.Title, tc.Priority,
      latest.Result AS LatestResult,
      CONVERT(VARCHAR(19), latest.ExecutedAt, 126) AS LatestExecutedAt
    FROM QaTestRunCases rc
    JOIN QaTestCases tc ON tc.Id = rc.TestCaseId
    OUTER APPLY (
      SELECT TOP 1 e.Result, e.ExecutedAt FROM QaTestExecutions e
      WHERE e.TestRunCaseId = rc.Id ORDER BY e.ExecutedAt DESC
    ) latest
    WHERE rc.TestRunId = @id
    ORDER BY tc.TestCaseNumber ASC
  `);

  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_manage_runs");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const runId = Number(id);
  if (!Number.isInteger(runId)) {
    return NextResponse.json({ ok: false, error: "Invalid test run id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const testCaseIds: number[] = Array.isArray(body?.testCaseIds)
    ? body.testCaseIds.map((v: unknown) => Number(v)).filter((v: number) => Number.isInteger(v))
    : [];
  const assignedUserId = body?.assignedUserId != null ? Number(body.assignedUserId) : null;

  if (testCaseIds.length === 0) {
    return NextResponse.json({ ok: false, error: "At least one testCaseId is required." }, { status: 400 });
  }
  if (assignedUserId !== null && !Number.isInteger(assignedUserId)) {
    return NextResponse.json({ ok: false, error: "Invalid assignedUserId." }, { status: 400 });
  }

  const db = await getDb();
  const runCheck = await db.request().input("id", sql.Int, runId).query<{ Id: number }>(
    "SELECT Id FROM QaTestRuns WHERE Id = @id"
  );
  if (!runCheck.recordset[0]) {
    return NextResponse.json({ ok: false, error: "Test run not found." }, { status: 404 });
  }

  let added = 0;
  for (const testCaseId of testCaseIds) {
    const result = await db
      .request()
      .input("testRunId", sql.Int, runId)
      .input("testCaseId", sql.Int, testCaseId)
      .input("assignedUserId", sql.Int, assignedUserId)
      .query(`
        IF EXISTS (SELECT Id FROM QaTestCases WHERE Id = @testCaseId)
          AND NOT EXISTS (SELECT Id FROM QaTestRunCases WHERE TestRunId = @testRunId AND TestCaseId = @testCaseId)
        INSERT INTO QaTestRunCases (TestRunId, TestCaseId, AssignedUserId) VALUES (@testRunId, @testCaseId, @assignedUserId)
      `);
    if ((result.rowsAffected[0] ?? 0) > 0) added++;
  }

  await logAdminAction({ admin: qa, section: "qa", action: "add_test_run_cases", details: `run ${runId}: +${added} cases`, req });
  await logQaActivity({ entityType: "TestRun", entityId: runId, action: "add_cases", userId: qa.userId, newValue: { testCaseIds, added }, req });

  return NextResponse.json({ ok: true, data: { added } });
}
