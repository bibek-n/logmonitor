import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import { VALID_TEST_RUN_STATUSES, type QaTestPlanRow } from "@/lib/qaShared";

const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 1000;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const testPlanId = Number(id);
  if (!Number.isInteger(testPlanId)) {
    return NextResponse.json({ ok: false, error: "Invalid test plan id." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, testPlanId).query<QaTestPlanRow>(`
    SELECT Id, TestPlanNumber, ProjectId, ReleaseId, Name, Description, Status, CreatedByUserId,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt,
      CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
    FROM QaTestPlans WHERE Id = @id
  `);
  const testPlan = result.recordset[0];
  if (!testPlan) {
    return NextResponse.json({ ok: false, error: "Test plan not found." }, { status: 404 });
  }

  // Linked runs + each run's own pass/total, aggregated for the plan-level progress bar — same
  // "latest execution per run-case" logic used on the test run detail page, just summed across
  // every run linked to this plan instead of one.
  const runsResult = await db.request().input("id", sql.Int, testPlanId).query<{
    Id: number; TestRunNumber: string; Name: string; Status: string; Total: number; Passed: number; Executed: number;
  }>(`
    SELECT r.Id, r.TestRunNumber, r.Name, r.Status,
      COUNT(rc.Id) AS Total,
      SUM(CASE WHEN latest.Result = 'Passed' THEN 1 ELSE 0 END) AS Passed,
      SUM(CASE WHEN latest.Result IS NOT NULL THEN 1 ELSE 0 END) AS Executed
    FROM QaTestPlanRuns tpr
    JOIN QaTestRuns r ON r.Id = tpr.TestRunId
    LEFT JOIN QaTestRunCases rc ON rc.TestRunId = r.Id
    OUTER APPLY (
      SELECT TOP 1 e.Result FROM QaTestExecutions e WHERE e.TestRunCaseId = rc.Id ORDER BY e.ExecutedAt DESC
    ) latest
    WHERE tpr.TestPlanId = @id
    GROUP BY r.Id, r.TestRunNumber, r.Name, r.Status
    ORDER BY r.TestRunNumber ASC
  `);

  const totals = runsResult.recordset.reduce(
    (acc, r) => ({ total: acc.total + r.Total, passed: acc.passed + r.Passed, executed: acc.executed + r.Executed }),
    { total: 0, passed: 0, executed: 0 }
  );

  return NextResponse.json({
    ok: true,
    data: { ...testPlan, runs: runsResult.recordset, progress: totals },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_edit");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const testPlanId = Number(id);
  if (!Number.isInteger(testPlanId)) {
    return NextResponse.json({ ok: false, error: "Invalid test plan id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const db = await getDb();

  const existingResult = await db.request().input("id", sql.Int, testPlanId).query<QaTestPlanRow>(
    "SELECT * FROM QaTestPlans WHERE Id = @id"
  );
  const existing = existingResult.recordset[0];
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Test plan not found." }, { status: 404 });
  }

  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : existing.Name;
  const description = body?.description !== undefined ? (typeof body.description === "string" ? body.description.trim() || null : null) : existing.Description;
  const releaseId = body?.releaseId !== undefined ? (body.releaseId === null ? null : Number(body.releaseId)) : existing.ReleaseId;
  const status = typeof body?.status === "string" && VALID_TEST_RUN_STATUSES.has(body.status) ? body.status : existing.Status;

  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` }, { status: 400 });
  }
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json({ ok: false, error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.` }, { status: 400 });
  }
  if (releaseId !== null && !Number.isInteger(releaseId)) {
    return NextResponse.json({ ok: false, error: "Invalid releaseId." }, { status: 400 });
  }

  await db
    .request()
    .input("id", sql.Int, testPlanId)
    .input("name", sql.NVarChar, name)
    .input("description", sql.NVarChar, description)
    .input("releaseId", sql.Int, releaseId)
    .input("status", sql.VarChar, status)
    .query(`
      UPDATE QaTestPlans SET Name = @name, Description = @description, ReleaseId = @releaseId,
        Status = @status, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id
    `);

  // Replace-in-full when provided, same pattern as every other junction table in this module.
  if (Array.isArray(body?.testRunIds)) {
    const testRunIds: number[] = [...new Set<number>(body.testRunIds.map((v: unknown) => Number(v)).filter((v: number) => Number.isInteger(v)))];
    await db.request().input("testPlanId", sql.Int, testPlanId).query("DELETE FROM QaTestPlanRuns WHERE TestPlanId = @testPlanId");
    for (const testRunId of testRunIds) {
      await db.request().input("testPlanId", sql.Int, testPlanId).input("testRunId", sql.Int, testRunId)
        .query(`
          IF EXISTS (SELECT Id FROM QaTestRuns WHERE Id = @testRunId)
          INSERT INTO QaTestPlanRuns (TestPlanId, TestRunId) VALUES (@testPlanId, @testRunId)
        `);
    }
  }

  await logAdminAction({ admin: qa, section: "qa", action: "update_test_plan", details: existing.TestPlanNumber, req });
  await logQaActivity({
    entityType: "TestPlan", entityId: testPlanId, action: "update", userId: qa.userId,
    previousValue: existing, newValue: { name, description, status }, req,
  });

  return NextResponse.json({ ok: true });
}
