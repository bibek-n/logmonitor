import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import { withReferenceNumber } from "@/lib/qaReferenceNumbers";
import {
  VALID_PRIORITIES, VALID_BUG_SEVERITIES, ALLOWED_BUG_SORT_COLUMNS, buildBugFilters, type QaBugRow,
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

  const { conditions, params, error } = buildBugFilters(sp);
  if (error) return NextResponse.json({ ok: false, error }, { status: 400 });

  const sortByParam = sp.get("sortBy") ?? "";
  const sortColumn = ALLOWED_BUG_SORT_COLUMNS.has(sortByParam) ? sortByParam : "CreatedAt";
  const sortDir = sp.get("sortDir") === "asc" ? "ASC" : "DESC";
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const db = await getDb();

  const countRequest = db.request();
  for (const p of params) countRequest.input(p.name, p.type, p.value);
  const countResult = await countRequest.query<{ Total: number }>(`SELECT COUNT(*) AS Total FROM QaBugs ${where}`);
  const total = countResult.recordset[0]?.Total ?? 0;

  const rowsRequest = db.request();
  for (const p of params) rowsRequest.input(p.name, p.type, p.value);
  rowsRequest.input("offset", sql.Int, offset);
  rowsRequest.input("pageSize", sql.Int, pageSize);
  const rowsResult = await rowsRequest.query<QaBugRow>(`
    SELECT Id, BugNumber, Title, ProjectId, TestCaseId, TestExecutionId, TestRunId, Severity,
      Priority, Status, AssignedDeveloperUserId, ReporterUserId, Environment, Browser, Device, AppVersion,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt,
      CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt,
      CONVERT(VARCHAR(19), ResolvedAt, 126) AS ResolvedAt
    FROM QaBugs ${where}
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
  const qa = await requireQaPermission("qa_manage_bugs");
  if (!isQaSession(qa)) return qa;

  const body = await req.json().catch(() => null);
  const projectId = Number(body?.projectId);
  const testCaseId = body?.testCaseId != null ? Number(body.testCaseId) : null;
  const testExecutionId = body?.testExecutionId != null ? Number(body.testExecutionId) : null;
  const testRunId = body?.testRunId != null ? Number(body.testRunId) : null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? (body.description.trim() || null) : null;
  const stepsToReproduce = typeof body?.stepsToReproduce === "string" ? (body.stepsToReproduce.trim() || null) : null;
  const expectedResult = typeof body?.expectedResult === "string" ? (body.expectedResult.trim() || null) : null;
  const actualResult = typeof body?.actualResult === "string" ? (body.actualResult.trim() || null) : null;
  const severity = typeof body?.severity === "string" && VALID_BUG_SEVERITIES.has(body.severity) ? body.severity : "Medium";
  const priority = typeof body?.priority === "string" && VALID_PRIORITIES.has(body.priority) ? body.priority : "Medium";
  const environment = typeof body?.environment === "string" ? (body.environment.trim() || null) : null;
  const browser = typeof body?.browser === "string" ? (body.browser.trim() || null) : null;
  const device = typeof body?.device === "string" ? (body.device.trim() || null) : null;
  const appVersion = typeof body?.appVersion === "string" ? (body.appVersion.trim() || null) : null;

  if (!Number.isInteger(projectId)) return NextResponse.json({ ok: false, error: "A valid projectId is required." }, { status: 400 });
  if (!title) return NextResponse.json({ ok: false, error: "Title is required." }, { status: 400 });
  if (title.length > MAX_TITLE_LENGTH) return NextResponse.json({ ok: false, error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer.` }, { status: 400 });
  for (const [label, value] of [["testCaseId", testCaseId], ["testExecutionId", testExecutionId], ["testRunId", testRunId]] as const) {
    if (value !== null && !Number.isInteger(value)) return NextResponse.json({ ok: false, error: `Invalid ${label}.` }, { status: 400 });
  }

  const db = await getDb();
  const projectCheck = await db.request().input("id", sql.Int, projectId).query<{ Id: number }>(
    "SELECT Id FROM QaProjects WHERE Id = @id"
  );
  if (!projectCheck.recordset[0]) {
    return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
  }

  const bug = await withReferenceNumber("QaBugs", "BugNumber", "BUG", async (transaction, bugNumber) => {
    const insertRequest = new sql.Request(transaction);
    const insertResult = await insertRequest
      .input("bugNumber", sql.VarChar, bugNumber)
      .input("title", sql.NVarChar, title)
      .input("description", sql.NVarChar, description)
      .input("projectId", sql.Int, projectId)
      .input("testCaseId", sql.Int, testCaseId)
      .input("testExecutionId", sql.Int, testExecutionId)
      .input("testRunId", sql.Int, testRunId)
      .input("stepsToReproduce", sql.NVarChar, stepsToReproduce)
      .input("expectedResult", sql.NVarChar, expectedResult)
      .input("actualResult", sql.NVarChar, actualResult)
      .input("severity", sql.VarChar, severity)
      .input("priority", sql.VarChar, priority)
      .input("reporterUserId", sql.Int, qa.userId)
      .input("environment", sql.NVarChar, environment)
      .input("browser", sql.NVarChar, browser)
      .input("device", sql.NVarChar, device)
      .input("appVersion", sql.NVarChar, appVersion)
      .query<QaBugRow>(`
        INSERT INTO QaBugs (
          BugNumber, Title, Description, ProjectId, TestCaseId, TestExecutionId, TestRunId,
          StepsToReproduce, ExpectedResult, ActualResult, Severity, Priority, ReporterUserId,
          Environment, Browser, Device, AppVersion
        )
        OUTPUT INSERTED.Id, INSERTED.BugNumber, INSERTED.Title, INSERTED.Description,
          INSERTED.ProjectId, INSERTED.TestCaseId, INSERTED.TestExecutionId, INSERTED.TestRunId,
          INSERTED.StepsToReproduce, INSERTED.ExpectedResult, INSERTED.ActualResult,
          INSERTED.Severity, INSERTED.Priority, INSERTED.Status, INSERTED.AssignedDeveloperUserId,
          INSERTED.ReporterUserId, INSERTED.Environment, INSERTED.Browser, INSERTED.Device, INSERTED.AppVersion,
          CONVERT(VARCHAR(19), INSERTED.CreatedAt, 126) AS CreatedAt,
          CONVERT(VARCHAR(19), INSERTED.UpdatedAt, 126) AS UpdatedAt,
          CONVERT(VARCHAR(19), INSERTED.ResolvedAt, 126) AS ResolvedAt
        VALUES (
          @bugNumber, @title, @description, @projectId, @testCaseId, @testExecutionId, @testRunId,
          @stepsToReproduce, @expectedResult, @actualResult, @severity, @priority, @reporterUserId,
          @environment, @browser, @device, @appVersion
        )
      `);
    return insertResult.recordset[0];
  });

  await logAdminAction({ admin: qa, section: "qa", action: "create_bug", details: bug.BugNumber, req });
  await logQaActivity({ entityType: "Bug", entityId: bug.Id, action: "create", userId: qa.userId, newValue: bug, req });

  return NextResponse.json({ ok: true, data: bug });
}
