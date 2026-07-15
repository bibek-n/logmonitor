import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import { withReferenceNumber } from "@/lib/qaReferenceNumbers";
import {
  ALLOWED_TEST_RUN_SORT_COLUMNS, buildTestRunFilters, type QaTestRunRow,
} from "@/lib/qaShared";

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 200;
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 1000;

export async function GET(req: NextRequest) {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(sp.get("pageSize")) || PAGE_SIZE_DEFAULT));
  const offset = (page - 1) * pageSize;

  const { conditions, params, error } = buildTestRunFilters(sp);
  if (error) return NextResponse.json({ ok: false, error }, { status: 400 });

  const sortByParam = sp.get("sortBy") ?? "";
  const sortColumn = ALLOWED_TEST_RUN_SORT_COLUMNS.has(sortByParam) ? sortByParam : "CreatedAt";
  const sortDir = sp.get("sortDir") === "asc" ? "ASC" : "DESC";
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const db = await getDb();

  const countRequest = db.request();
  for (const p of params) countRequest.input(p.name, p.type, p.value);
  const countResult = await countRequest.query<{ Total: number }>(`SELECT COUNT(*) AS Total FROM QaTestRuns ${where}`);
  const total = countResult.recordset[0]?.Total ?? 0;

  const rowsRequest = db.request();
  for (const p of params) rowsRequest.input(p.name, p.type, p.value);
  rowsRequest.input("offset", sql.Int, offset);
  rowsRequest.input("pageSize", sql.Int, pageSize);
  const rowsResult = await rowsRequest.query<QaTestRunRow>(`
    SELECT r.Id, r.TestRunNumber, r.Name, r.Description, r.ProjectId, r.ReleaseId, r.Environment, r.Browser,
      r.OperatingSystem, r.Device,
      CONVERT(VARCHAR(10), r.StartDate, 126) AS StartDate,
      CONVERT(VARCHAR(10), r.EndDate, 126) AS EndDate,
      r.Status, r.RunTypeId, rt.Name AS RunTypeName, r.DeployedBuildVersion,
      CONVERT(VARCHAR(19), r.DeployedAt, 126) AS DeployedAt,
      r.QaApprovedByUserId, CONVERT(VARCHAR(19), r.QaApprovedAt, 126) AS QaApprovedAt,
      r.CreatedByUserId,
      CONVERT(VARCHAR(19), r.CreatedAt, 126) AS CreatedAt,
      CONVERT(VARCHAR(19), r.UpdatedAt, 126) AS UpdatedAt
    FROM QaTestRuns r
    LEFT JOIN QaTestRunTypes rt ON rt.Id = r.RunTypeId
    ${where}
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
  const qa = await requireQaPermission("qa_manage_runs");
  if (!isQaSession(qa)) return qa;

  const body = await req.json().catch(() => null);
  const projectId = Number(body?.projectId);
  const releaseId = body?.releaseId != null ? Number(body.releaseId) : null;
  const runTypeId = body?.runTypeId != null ? Number(body.runTypeId) : null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? (body.description.trim() || null) : null;
  const environment = typeof body?.environment === "string" ? (body.environment.trim() || null) : null;
  const browser = typeof body?.browser === "string" ? (body.browser.trim() || null) : null;
  const operatingSystem = typeof body?.operatingSystem === "string" ? (body.operatingSystem.trim() || null) : null;
  const device = typeof body?.device === "string" ? (body.device.trim() || null) : null;
  const testCaseIds: number[] = Array.isArray(body?.testCaseIds)
    ? body.testCaseIds.map((v: unknown) => Number(v)).filter((v: number) => Number.isInteger(v))
    : [];

  if (!Number.isInteger(projectId)) return NextResponse.json({ ok: false, error: "A valid projectId is required." }, { status: 400 });
  if (releaseId !== null && !Number.isInteger(releaseId)) return NextResponse.json({ ok: false, error: "Invalid releaseId." }, { status: 400 });
  if (runTypeId !== null && !Number.isInteger(runTypeId)) return NextResponse.json({ ok: false, error: "Invalid runTypeId." }, { status: 400 });
  if (!name) return NextResponse.json({ ok: false, error: "Test run name is required." }, { status: 400 });
  if (name.length > MAX_NAME_LENGTH) return NextResponse.json({ ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` }, { status: 400 });
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json({ ok: false, error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.` }, { status: 400 });
  }

  const db = await getDb();
  const projectCheck = await db.request().input("id", sql.Int, projectId).query<{ Id: number }>(
    "SELECT Id FROM QaProjects WHERE Id = @id"
  );
  if (!projectCheck.recordset[0]) {
    return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
  }
  if (runTypeId !== null) {
    const runTypeCheck = await db.request().input("id", sql.Int, runTypeId).query<{ Id: number }>(
      "SELECT Id FROM QaTestRunTypes WHERE Id = @id AND IsActive = 1"
    );
    if (!runTypeCheck.recordset[0]) {
      return NextResponse.json({ ok: false, error: "Run type not found." }, { status: 404 });
    }
  }

  const run = await withReferenceNumber("QaTestRuns", "TestRunNumber", "TR", async (transaction, testRunNumber) => {
    const insertRequest = new sql.Request(transaction);
    const insertResult = await insertRequest
      .input("testRunNumber", sql.VarChar, testRunNumber)
      .input("name", sql.NVarChar, name)
      .input("description", sql.NVarChar, description)
      .input("projectId", sql.Int, projectId)
      .input("releaseId", sql.Int, releaseId)
      .input("environment", sql.NVarChar, environment)
      .input("browser", sql.NVarChar, browser)
      .input("operatingSystem", sql.NVarChar, operatingSystem)
      .input("device", sql.NVarChar, device)
      .input("runTypeId", sql.Int, runTypeId)
      .input("createdByUserId", sql.Int, qa.userId)
      .query<QaTestRunRow>(`
        INSERT INTO QaTestRuns (
          TestRunNumber, Name, Description, ProjectId, ReleaseId, Environment, Browser,
          OperatingSystem, Device, RunTypeId, CreatedByUserId
        )
        OUTPUT INSERTED.Id, INSERTED.TestRunNumber, INSERTED.Name, INSERTED.Description,
          INSERTED.ProjectId, INSERTED.ReleaseId, INSERTED.Environment, INSERTED.Browser,
          INSERTED.OperatingSystem, INSERTED.Device,
          CONVERT(VARCHAR(10), INSERTED.StartDate, 126) AS StartDate,
          CONVERT(VARCHAR(10), INSERTED.EndDate, 126) AS EndDate,
          INSERTED.Status, INSERTED.RunTypeId, INSERTED.CreatedByUserId,
          CONVERT(VARCHAR(19), INSERTED.CreatedAt, 126) AS CreatedAt,
          CONVERT(VARCHAR(19), INSERTED.UpdatedAt, 126) AS UpdatedAt
        VALUES (
          @testRunNumber, @name, @description, @projectId, @releaseId, @environment, @browser,
          @operatingSystem, @device, @runTypeId, @createdByUserId
        )
      `);
    const row = insertResult.recordset[0];

    for (const testCaseId of testCaseIds) {
      const caseRequest = new sql.Request(transaction);
      await caseRequest
        .input("testRunId", sql.Int, row.Id)
        .input("testCaseId", sql.Int, testCaseId)
        .query(`
          IF EXISTS (SELECT Id FROM QaTestCases WHERE Id = @testCaseId)
          INSERT INTO QaTestRunCases (TestRunId, TestCaseId) VALUES (@testRunId, @testCaseId)
        `);
    }

    return row;
  });

  await logAdminAction({ admin: qa, section: "qa", action: "create_test_run", details: run.TestRunNumber, req });
  await logQaActivity({ entityType: "TestRun", entityId: run.Id, action: "create", userId: qa.userId, newValue: run, req });

  return NextResponse.json({ ok: true, data: run });
}
