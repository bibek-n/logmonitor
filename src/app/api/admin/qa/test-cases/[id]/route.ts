import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import {
  VALID_PRIORITIES, VALID_TEST_TYPES, VALID_TEST_CASE_STATUSES, VALID_AUTOMATION_STATUSES,
  type QaTestCaseRow, type QaTestCaseStepInput, type QaTestCaseStepRow,
} from "@/lib/qaShared";

const MAX_TITLE_LENGTH = 300;

async function loadStepsAndTags(testCaseId: number) {
  const db = await getDb();
  const [steps, tags, runTypes] = await Promise.all([
    db.request().input("id", sql.Int, testCaseId).query<QaTestCaseStepRow>(
      "SELECT Id, StepNumber, Action, TestData, ExpectedResult FROM QaTestCaseSteps WHERE TestCaseId = @id ORDER BY StepNumber ASC"
    ),
    db.request().input("id", sql.Int, testCaseId).query<{ Tag: string }>(
      "SELECT Tag FROM QaTestCaseTags WHERE TestCaseId = @id ORDER BY Tag ASC"
    ),
    db.request().input("id", sql.Int, testCaseId).query<{ RunTypeId: number }>(
      "SELECT RunTypeId FROM QaTestCaseRunTypes WHERE TestCaseId = @id ORDER BY RunTypeId ASC"
    ),
  ]);
  return { steps: steps.recordset, tags: tags.recordset.map((t) => t.Tag), runTypeIds: runTypes.recordset.map((r) => r.RunTypeId) };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const testCaseId = Number(id);
  if (!Number.isInteger(testCaseId)) {
    return NextResponse.json({ ok: false, error: "Invalid test case id." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, testCaseId).query<QaTestCaseRow>(`
    SELECT Id, ProjectId, ModuleId, TestSuiteId, TestCaseNumber, Title, Description, Preconditions,
      ExpectedResult, Priority, Severity, TestType, AutomationStatus, EstimatedMinutes, Status,
      ReviewedByUserId, CONVERT(VARCHAR(19), ReviewedAt, 126) AS ReviewedAt,
      CreatedByUserId, UpdatedByUserId,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt,
      CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
    FROM QaTestCases WHERE Id = @id
  `);
  const testCase = result.recordset[0];
  if (!testCase) {
    return NextResponse.json({ ok: false, error: "Test case not found." }, { status: 404 });
  }

  const { steps, tags, runTypeIds } = await loadStepsAndTags(testCaseId);
  return NextResponse.json({ ok: true, data: { ...testCase, steps, tags, runTypeIds } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_edit");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const testCaseId = Number(id);
  if (!Number.isInteger(testCaseId)) {
    return NextResponse.json({ ok: false, error: "Invalid test case id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const db = await getDb();

  const existingResult = await db.request().input("id", sql.Int, testCaseId).query<QaTestCaseRow>(
    "SELECT * FROM QaTestCases WHERE Id = @id"
  );
  const existing = existingResult.recordset[0];
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Test case not found." }, { status: 404 });
  }

  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim() : existing.Title;
  const description = body?.description !== undefined ? (typeof body.description === "string" ? body.description.trim() || null : null) : existing.Description;
  const preconditions = body?.preconditions !== undefined ? (typeof body.preconditions === "string" ? body.preconditions.trim() || null : null) : existing.Preconditions;
  const expectedResult = body?.expectedResult !== undefined ? (typeof body.expectedResult === "string" ? body.expectedResult.trim() || null : null) : existing.ExpectedResult;
  const priority = typeof body?.priority === "string" && VALID_PRIORITIES.has(body.priority) ? body.priority : existing.Priority;
  const severity = body?.severity !== undefined ? (typeof body.severity === "string" ? body.severity.trim() || null : null) : existing.Severity;
  const testType = typeof body?.testType === "string" && VALID_TEST_TYPES.has(body.testType) ? body.testType : existing.TestType;
  const automationStatus = typeof body?.automationStatus === "string" && VALID_AUTOMATION_STATUSES.has(body.automationStatus) ? body.automationStatus : existing.AutomationStatus;
  const status = typeof body?.status === "string" && VALID_TEST_CASE_STATUSES.has(body.status) ? body.status : existing.Status;
  const estimatedMinutes = body?.estimatedMinutes !== undefined
    ? (body.estimatedMinutes === null ? null : Number(body.estimatedMinutes))
    : existing.EstimatedMinutes;

  // "Review Test Cases" step: an explicit reviewer action, distinct from Status — a case can
  // be Status='Ready' without a human having actually reviewed it yet. `reviewed: true` stamps
  // who/when; `reviewed: false` explicitly un-reviews it (e.g. after a substantive edit).
  // Omitting the field leaves the existing review stamp untouched.
  const clearingReview = body?.reviewed === false;
  const settingReview = body?.reviewed === true;

  if (title.length > MAX_TITLE_LENGTH) {
    return NextResponse.json({ ok: false, error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer.` }, { status: 400 });
  }
  if (estimatedMinutes !== null && (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 0)) {
    return NextResponse.json({ ok: false, error: "Estimated execution time must be a non-negative whole number of minutes." }, { status: 400 });
  }

  const updateRequest = db
    .request()
    .input("id", sql.Int, testCaseId)
    .input("title", sql.NVarChar, title)
    .input("description", sql.NVarChar, description)
    .input("preconditions", sql.NVarChar, preconditions)
    .input("expectedResult", sql.NVarChar, expectedResult)
    .input("priority", sql.VarChar, priority)
    .input("severity", sql.VarChar, severity)
    .input("testType", sql.VarChar, testType)
    .input("automationStatus", sql.VarChar, automationStatus)
    .input("status", sql.VarChar, status)
    .input("estimatedMinutes", sql.Int, estimatedMinutes)
    .input("updatedByUserId", sql.Int, qa.userId);

  let setClause = `
    Title = @title, Description = @description, Preconditions = @preconditions,
    ExpectedResult = @expectedResult, Priority = @priority, Severity = @severity,
    TestType = @testType, AutomationStatus = @automationStatus, Status = @status,
    EstimatedMinutes = @estimatedMinutes, UpdatedByUserId = @updatedByUserId,
    UpdatedAt = SYSUTCDATETIME()
  `;
  if (settingReview) {
    updateRequest.input("reviewedByUserId", sql.Int, qa.userId);
    setClause += ", ReviewedByUserId = @reviewedByUserId, ReviewedAt = SYSUTCDATETIME()";
  } else if (clearingReview) {
    setClause += ", ReviewedByUserId = NULL, ReviewedAt = NULL";
  }

  await updateRequest.query(`UPDATE QaTestCases SET ${setClause} WHERE Id = @id`);

  // Steps/tags are replace-in-full when provided (simpler and safer than diffing individual
  // rows — matches how this app has no precedent for partial child-collection updates
  // anywhere else either).
  if (Array.isArray(body?.steps)) {
    const steps: QaTestCaseStepInput[] = body.steps
      .filter((s: unknown): s is QaTestCaseStepInput => typeof s === "object" && s !== null && typeof (s as QaTestCaseStepInput).action === "string")
      .map((s: QaTestCaseStepInput, i: number) => ({
        stepNumber: i + 1,
        action: s.action.trim(),
        testData: typeof s.testData === "string" ? s.testData.trim() || null : null,
        expectedResult: typeof s.expectedResult === "string" ? s.expectedResult.trim() || null : null,
      }));
    await db.request().input("testCaseId", sql.Int, testCaseId).query("DELETE FROM QaTestCaseSteps WHERE TestCaseId = @testCaseId");
    for (const step of steps) {
      await db
        .request()
        .input("testCaseId", sql.Int, testCaseId)
        .input("stepNumber", sql.Int, step.stepNumber)
        .input("action", sql.NVarChar, step.action)
        .input("testData", sql.NVarChar, step.testData)
        .input("expectedResult", sql.NVarChar, step.expectedResult)
        .query("INSERT INTO QaTestCaseSteps (TestCaseId, StepNumber, Action, TestData, ExpectedResult) VALUES (@testCaseId, @stepNumber, @action, @testData, @expectedResult)");
    }
  }

  if (Array.isArray(body?.tags)) {
    const tags: string[] = body.tags.filter((t: unknown) => typeof t === "string" && t.trim()).map((t: string) => t.trim().slice(0, 50));
    await db.request().input("testCaseId", sql.Int, testCaseId).query("DELETE FROM QaTestCaseTags WHERE TestCaseId = @testCaseId");
    for (const tag of tags) {
      await db.request().input("testCaseId", sql.Int, testCaseId).input("tag", sql.NVarChar, tag)
        .query("INSERT INTO QaTestCaseTags (TestCaseId, Tag) VALUES (@testCaseId, @tag)");
    }
  }

  if (Array.isArray(body?.runTypeIds)) {
    const runTypeIds: number[] = [...new Set<number>(body.runTypeIds.map((v: unknown) => Number(v)).filter((v: number) => Number.isInteger(v)))];
    await db.request().input("testCaseId", sql.Int, testCaseId).query("DELETE FROM QaTestCaseRunTypes WHERE TestCaseId = @testCaseId");
    for (const runTypeId of runTypeIds) {
      await db.request().input("testCaseId", sql.Int, testCaseId).input("runTypeId", sql.Int, runTypeId)
        .query(`
          IF EXISTS (SELECT Id FROM QaTestRunTypes WHERE Id = @runTypeId)
          INSERT INTO QaTestCaseRunTypes (TestCaseId, RunTypeId) VALUES (@testCaseId, @runTypeId)
        `);
    }
  }

  await logAdminAction({ admin: qa, section: "qa", action: "update_test_case", details: existing.TestCaseNumber, req });
  await logQaActivity({
    entityType: "TestCase", entityId: testCaseId, action: "update", userId: qa.userId,
    previousValue: existing, newValue: { title, description, priority, severity, testType, status }, req,
  });

  return NextResponse.json({ ok: true });
}

// Archive, not hard-delete — same rationale as test suites: test cases are referenced by
// QaTestRunCases/QaBugs (nullable FKs on the bug side, but still meaningful history), so a
// real delete would either break FK integrity or silently orphan execution/bug history.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_delete");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const testCaseId = Number(id);
  if (!Number.isInteger(testCaseId)) {
    return NextResponse.json({ ok: false, error: "Invalid test case id." }, { status: 400 });
  }

  const db = await getDb();
  const existingResult = await db.request().input("id", sql.Int, testCaseId).query<{ TestCaseNumber: string; Status: string }>(
    "SELECT TestCaseNumber, Status FROM QaTestCases WHERE Id = @id"
  );
  const existing = existingResult.recordset[0];
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Test case not found." }, { status: 404 });
  }

  await db
    .request()
    .input("id", sql.Int, testCaseId)
    .input("updatedByUserId", sql.Int, qa.userId)
    .query("UPDATE QaTestCases SET Status = 'Archived', UpdatedByUserId = @updatedByUserId, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");

  await logAdminAction({ admin: qa, section: "qa", action: "archive_test_case", details: existing.TestCaseNumber, req });
  await logQaActivity({
    entityType: "TestCase", entityId: testCaseId, action: "archive", userId: qa.userId,
    previousValue: { Status: existing.Status }, newValue: { Status: "Archived" }, req,
  });

  return NextResponse.json({ ok: true });
}
