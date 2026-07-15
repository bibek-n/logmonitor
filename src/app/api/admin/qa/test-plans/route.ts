import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import { withReferenceNumber } from "@/lib/qaReferenceNumbers";
import {
  ALLOWED_TEST_PLAN_SORT_COLUMNS, buildTestPlanFilters, type QaTestPlanRow,
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

  const { conditions, params, error } = buildTestPlanFilters(sp);
  if (error) return NextResponse.json({ ok: false, error }, { status: 400 });

  const sortByParam = sp.get("sortBy") ?? "";
  const sortColumn = ALLOWED_TEST_PLAN_SORT_COLUMNS.has(sortByParam) ? sortByParam : "CreatedAt";
  const sortDir = sp.get("sortDir") === "asc" ? "ASC" : "DESC";
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const db = await getDb();

  const countRequest = db.request();
  for (const p of params) countRequest.input(p.name, p.type, p.value);
  const countResult = await countRequest.query<{ Total: number }>(`SELECT COUNT(*) AS Total FROM QaTestPlans ${where}`);
  const total = countResult.recordset[0]?.Total ?? 0;

  const rowsRequest = db.request();
  for (const p of params) rowsRequest.input(p.name, p.type, p.value);
  rowsRequest.input("offset", sql.Int, offset);
  rowsRequest.input("pageSize", sql.Int, pageSize);
  const rowsResult = await rowsRequest.query<QaTestPlanRow>(`
    SELECT Id, TestPlanNumber, ProjectId, ReleaseId, Name, Description, Status, CreatedByUserId,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt,
      CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
    FROM QaTestPlans ${where}
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
  const releaseId = body?.releaseId != null ? Number(body.releaseId) : null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? (body.description.trim() || null) : null;
  const testRunIds: number[] = Array.isArray(body?.testRunIds)
    ? [...new Set<number>(body.testRunIds.map((v: unknown) => Number(v)).filter((v: number) => Number.isInteger(v)))]
    : [];

  if (!Number.isInteger(projectId)) return NextResponse.json({ ok: false, error: "A valid projectId is required." }, { status: 400 });
  if (releaseId !== null && !Number.isInteger(releaseId)) return NextResponse.json({ ok: false, error: "Invalid releaseId." }, { status: 400 });
  if (!name) return NextResponse.json({ ok: false, error: "Test plan name is required." }, { status: 400 });
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

  const testPlan = await withReferenceNumber("QaTestPlans", "TestPlanNumber", "TP", async (transaction, testPlanNumber) => {
    const insertRequest = new sql.Request(transaction);
    const insertResult = await insertRequest
      .input("testPlanNumber", sql.VarChar, testPlanNumber)
      .input("projectId", sql.Int, projectId)
      .input("releaseId", sql.Int, releaseId)
      .input("name", sql.NVarChar, name)
      .input("description", sql.NVarChar, description)
      .input("createdByUserId", sql.Int, qa.userId)
      .query<QaTestPlanRow>(`
        INSERT INTO QaTestPlans (TestPlanNumber, ProjectId, ReleaseId, Name, Description, CreatedByUserId)
        OUTPUT INSERTED.Id, INSERTED.TestPlanNumber, INSERTED.ProjectId, INSERTED.ReleaseId,
          INSERTED.Name, INSERTED.Description, INSERTED.Status, INSERTED.CreatedByUserId,
          CONVERT(VARCHAR(19), INSERTED.CreatedAt, 126) AS CreatedAt,
          CONVERT(VARCHAR(19), INSERTED.UpdatedAt, 126) AS UpdatedAt
        VALUES (@testPlanNumber, @projectId, @releaseId, @name, @description, @createdByUserId)
      `);
    const row = insertResult.recordset[0];

    for (const testRunId of testRunIds) {
      const linkRequest = new sql.Request(transaction);
      await linkRequest
        .input("testPlanId", sql.Int, row.Id)
        .input("testRunId", sql.Int, testRunId)
        .query(`
          IF EXISTS (SELECT Id FROM QaTestRuns WHERE Id = @testRunId)
          INSERT INTO QaTestPlanRuns (TestPlanId, TestRunId) VALUES (@testPlanId, @testRunId)
        `);
    }

    return row;
  });

  await logAdminAction({ admin: qa, section: "qa", action: "create_test_plan", details: testPlan.TestPlanNumber, req });
  await logQaActivity({ entityType: "TestPlan", entityId: testPlan.Id, action: "create", userId: qa.userId, newValue: testPlan, req });

  return NextResponse.json({ ok: true, data: testPlan });
}
