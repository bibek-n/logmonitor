import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import { withReferenceNumber } from "@/lib/qaReferenceNumbers";
import {
  VALID_PRIORITIES, VALID_TEST_TYPES, VALID_AUTOMATION_STATUSES, ALLOWED_TEST_CASE_SORT_COLUMNS,
  buildTestCaseFilters, type QaTestCaseRow, type QaTestCaseStepInput,
} from "@/lib/qaShared";

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 200;
const MAX_TITLE_LENGTH = 300;

export async function GET(req: NextRequest) {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(sp.get("pageSize")) || PAGE_SIZE_DEFAULT));
  const offset = (page - 1) * pageSize;

  const { conditions, params, error } = buildTestCaseFilters(sp);
  if (error) return NextResponse.json({ ok: false, error }, { status: 400 });

  const sortByParam = sp.get("sortBy") ?? "";
  const sortColumn = ALLOWED_TEST_CASE_SORT_COLUMNS.has(sortByParam) ? sortByParam : "CreatedAt";
  const sortDir = sp.get("sortDir") === "asc" ? "ASC" : "DESC";
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const db = await getDb();

  const countRequest = db.request();
  for (const p of params) countRequest.input(p.name, p.type, p.value);
  const countResult = await countRequest.query<{ Total: number }>(`SELECT COUNT(*) AS Total FROM QaTestCases ${where}`);
  const total = countResult.recordset[0]?.Total ?? 0;

  const rowsRequest = db.request();
  for (const p of params) rowsRequest.input(p.name, p.type, p.value);
  rowsRequest.input("offset", sql.Int, offset);
  rowsRequest.input("pageSize", sql.Int, pageSize);
  const rowsResult = await rowsRequest.query<QaTestCaseRow>(`
    SELECT Id, ProjectId, ModuleId, TestSuiteId, TestCaseNumber, Title, Description, Preconditions,
      ExpectedResult, Priority, Severity, TestType, AutomationStatus, EstimatedMinutes, Status,
      CreatedByUserId, UpdatedByUserId,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt,
      CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
    FROM QaTestCases ${where}
    ORDER BY ${sortColumn} ${sortDir}
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);

  return NextResponse.json({
    ok: true,
    data: rowsResult.recordset,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}

export async function POST(req: NextRequest) {
  const qa = await requireQaPermission("qa_create");
  if (!isQaSession(qa)) return qa;

  const body = await req.json().catch(() => null);
  const projectId = Number(body?.projectId);
  const moduleId = body?.moduleId != null ? Number(body.moduleId) : null;
  const testSuiteId = Number(body?.testSuiteId);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? (body.description.trim() || null) : null;
  const preconditions = typeof body?.preconditions === "string" ? (body.preconditions.trim() || null) : null;
  const expectedResult = typeof body?.expectedResult === "string" ? (body.expectedResult.trim() || null) : null;
  const priority = typeof body?.priority === "string" && VALID_PRIORITIES.has(body.priority) ? body.priority : "Medium";
  const severity = typeof body?.severity === "string" && body.severity.trim() ? body.severity.trim() : null;
  const testType = typeof body?.testType === "string" && VALID_TEST_TYPES.has(body.testType) ? body.testType : "Functional";
  const automationStatus = typeof body?.automationStatus === "string" && VALID_AUTOMATION_STATUSES.has(body.automationStatus) ? body.automationStatus : "Manual";
  const estimatedMinutes = body?.estimatedMinutes != null ? Number(body.estimatedMinutes) : null;
  const tags: string[] = Array.isArray(body?.tags) ? body.tags.filter((t: unknown) => typeof t === "string" && t.trim()).map((t: string) => t.trim().slice(0, 50)) : [];
  const runTypeIds: number[] = Array.isArray(body?.runTypeIds)
    ? [...new Set<number>(body.runTypeIds.map((v: unknown) => Number(v)).filter((v: number) => Number.isInteger(v)))]
    : [];
  const steps: QaTestCaseStepInput[] = Array.isArray(body?.steps)
    ? body.steps
        .filter((s: unknown): s is QaTestCaseStepInput => typeof s === "object" && s !== null && typeof (s as QaTestCaseStepInput).action === "string")
        .map((s: QaTestCaseStepInput, i: number) => ({
          stepNumber: i + 1,
          action: s.action.trim(),
          testData: typeof s.testData === "string" ? s.testData.trim() || null : null,
          expectedResult: typeof s.expectedResult === "string" ? s.expectedResult.trim() || null : null,
        }))
    : [];

  if (!Number.isInteger(projectId)) return NextResponse.json({ ok: false, error: "A valid projectId is required." }, { status: 400 });
  if (moduleId !== null && !Number.isInteger(moduleId)) return NextResponse.json({ ok: false, error: "Invalid moduleId." }, { status: 400 });
  if (!Number.isInteger(testSuiteId)) return NextResponse.json({ ok: false, error: "A valid testSuiteId is required." }, { status: 400 });
  if (!title) return NextResponse.json({ ok: false, error: "Title is required." }, { status: 400 });
  if (title.length > MAX_TITLE_LENGTH) return NextResponse.json({ ok: false, error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer.` }, { status: 400 });
  if (estimatedMinutes !== null && (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 0)) {
    return NextResponse.json({ ok: false, error: "Estimated execution time must be a non-negative whole number of minutes." }, { status: 400 });
  }
  if (steps.some((s) => s.action.length === 0)) {
    return NextResponse.json({ ok: false, error: "Every test step needs an action." }, { status: 400 });
  }

  const db = await getDb();
  const suiteCheck = await db.request().input("id", sql.Int, testSuiteId).query<{ Id: number }>(
    "SELECT Id FROM QaTestSuites WHERE Id = @id"
  );
  if (!suiteCheck.recordset[0]) {
    return NextResponse.json({ ok: false, error: "Test suite not found." }, { status: 404 });
  }

  const testCase = await withReferenceNumber("QaTestCases", "TestCaseNumber", "TC", async (transaction, testCaseNumber) => {
    const insertRequest = new sql.Request(transaction);
    const insertResult = await insertRequest
      .input("projectId", sql.Int, projectId)
      .input("moduleId", sql.Int, moduleId)
      .input("testSuiteId", sql.Int, testSuiteId)
      .input("testCaseNumber", sql.VarChar, testCaseNumber)
      .input("title", sql.NVarChar, title)
      .input("description", sql.NVarChar, description)
      .input("preconditions", sql.NVarChar, preconditions)
      .input("expectedResult", sql.NVarChar, expectedResult)
      .input("priority", sql.VarChar, priority)
      .input("severity", sql.VarChar, severity)
      .input("testType", sql.VarChar, testType)
      .input("automationStatus", sql.VarChar, automationStatus)
      .input("estimatedMinutes", sql.Int, estimatedMinutes)
      .input("createdByUserId", sql.Int, qa.userId)
      .query<QaTestCaseRow>(`
        INSERT INTO QaTestCases (
          ProjectId, ModuleId, TestSuiteId, TestCaseNumber, Title, Description, Preconditions,
          ExpectedResult, Priority, Severity, TestType, AutomationStatus, EstimatedMinutes,
          CreatedByUserId, UpdatedByUserId
        )
        OUTPUT INSERTED.Id, INSERTED.ProjectId, INSERTED.ModuleId, INSERTED.TestSuiteId,
          INSERTED.TestCaseNumber, INSERTED.Title, INSERTED.Description, INSERTED.Preconditions,
          INSERTED.ExpectedResult, INSERTED.Priority, INSERTED.Severity, INSERTED.TestType,
          INSERTED.AutomationStatus, INSERTED.EstimatedMinutes, INSERTED.Status,
          INSERTED.CreatedByUserId, INSERTED.UpdatedByUserId,
          CONVERT(VARCHAR(19), INSERTED.CreatedAt, 126) AS CreatedAt,
          CONVERT(VARCHAR(19), INSERTED.UpdatedAt, 126) AS UpdatedAt
        VALUES (
          @projectId, @moduleId, @testSuiteId, @testCaseNumber, @title, @description, @preconditions,
          @expectedResult, @priority, @severity, @testType, @automationStatus, @estimatedMinutes,
          @createdByUserId, @createdByUserId
        )
      `);
    const row = insertResult.recordset[0];

    for (const step of steps) {
      const stepRequest = new sql.Request(transaction);
      await stepRequest
        .input("testCaseId", sql.Int, row.Id)
        .input("stepNumber", sql.Int, step.stepNumber)
        .input("action", sql.NVarChar, step.action)
        .input("testData", sql.NVarChar, step.testData)
        .input("expectedResult", sql.NVarChar, step.expectedResult)
        .query(`
          INSERT INTO QaTestCaseSteps (TestCaseId, StepNumber, Action, TestData, ExpectedResult)
          VALUES (@testCaseId, @stepNumber, @action, @testData, @expectedResult)
        `);
    }

    for (const tag of tags) {
      const tagRequest = new sql.Request(transaction);
      await tagRequest.input("testCaseId", sql.Int, row.Id).input("tag", sql.NVarChar, tag)
        .query("INSERT INTO QaTestCaseTags (TestCaseId, Tag) VALUES (@testCaseId, @tag)");
    }

    for (const runTypeId of runTypeIds) {
      const runTypeRequest = new sql.Request(transaction);
      await runTypeRequest
        .input("testCaseId", sql.Int, row.Id)
        .input("runTypeId", sql.Int, runTypeId)
        .query(`
          IF EXISTS (SELECT Id FROM QaTestRunTypes WHERE Id = @runTypeId)
          INSERT INTO QaTestCaseRunTypes (TestCaseId, RunTypeId) VALUES (@testCaseId, @runTypeId)
        `);
    }

    return row;
  });

  await logAdminAction({ admin: qa, section: "qa", action: "create_test_case", details: testCase.TestCaseNumber, req });
  await logQaActivity({ entityType: "TestCase", entityId: testCase.Id, action: "create", userId: qa.userId, newValue: testCase, req });

  return NextResponse.json({ ok: true, data: testCase });
}
