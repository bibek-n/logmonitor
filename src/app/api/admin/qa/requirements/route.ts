import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import { withReferenceNumber } from "@/lib/qaReferenceNumbers";
import {
  ALLOWED_REQUIREMENT_SORT_COLUMNS, buildRequirementFilters, VALID_PRIORITIES, type QaRequirementRow,
} from "@/lib/qaShared";

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 200;
const MAX_TITLE_LENGTH = 300;
const MAX_DESCRIPTION_LENGTH = 4000;

export async function GET(req: NextRequest) {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(sp.get("pageSize")) || PAGE_SIZE_DEFAULT));
  const offset = (page - 1) * pageSize;

  const { conditions, params, error } = buildRequirementFilters(sp);
  if (error) return NextResponse.json({ ok: false, error }, { status: 400 });

  const sortByParam = sp.get("sortBy") ?? "";
  const sortColumn = ALLOWED_REQUIREMENT_SORT_COLUMNS.has(sortByParam) ? sortByParam : "CreatedAt";
  const sortDir = sp.get("sortDir") === "asc" ? "ASC" : "DESC";
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const db = await getDb();

  const countRequest = db.request();
  for (const p of params) countRequest.input(p.name, p.type, p.value);
  const countResult = await countRequest.query<{ Total: number }>(`SELECT COUNT(*) AS Total FROM QaRequirements ${where}`);
  const total = countResult.recordset[0]?.Total ?? 0;

  const rowsRequest = db.request();
  for (const p of params) rowsRequest.input(p.name, p.type, p.value);
  rowsRequest.input("offset", sql.Int, offset);
  rowsRequest.input("pageSize", sql.Int, pageSize);
  const rowsResult = await rowsRequest.query<QaRequirementRow>(`
    SELECT Id, RequirementNumber, ProjectId, Title, Description, Category, Priority, Status,
      CreatedByUserId,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt,
      CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
    FROM QaRequirements ${where}
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
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? (body.description.trim() || null) : null;
  const category = typeof body?.category === "string" ? (body.category.trim() || null) : null;
  const priority = typeof body?.priority === "string" && VALID_PRIORITIES.has(body.priority) ? body.priority : "Medium";
  const testCaseIds: number[] = Array.isArray(body?.testCaseIds)
    ? [...new Set<number>(body.testCaseIds.map((v: unknown) => Number(v)).filter((v: number) => Number.isInteger(v)))]
    : [];

  if (!Number.isInteger(projectId)) return NextResponse.json({ ok: false, error: "A valid projectId is required." }, { status: 400 });
  if (!title) return NextResponse.json({ ok: false, error: "Title is required." }, { status: 400 });
  if (title.length > MAX_TITLE_LENGTH) return NextResponse.json({ ok: false, error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer.` }, { status: 400 });
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

  const requirement = await withReferenceNumber("QaRequirements", "RequirementNumber", "REQ", async (transaction, requirementNumber) => {
    const insertRequest = new sql.Request(transaction);
    const insertResult = await insertRequest
      .input("requirementNumber", sql.VarChar, requirementNumber)
      .input("projectId", sql.Int, projectId)
      .input("title", sql.NVarChar, title)
      .input("description", sql.NVarChar, description)
      .input("category", sql.NVarChar, category)
      .input("priority", sql.VarChar, priority)
      .input("createdByUserId", sql.Int, qa.userId)
      .query<QaRequirementRow>(`
        INSERT INTO QaRequirements (RequirementNumber, ProjectId, Title, Description, Category, Priority, CreatedByUserId)
        OUTPUT INSERTED.Id, INSERTED.RequirementNumber, INSERTED.ProjectId, INSERTED.Title,
          INSERTED.Description, INSERTED.Category, INSERTED.Priority, INSERTED.Status, INSERTED.CreatedByUserId,
          CONVERT(VARCHAR(19), INSERTED.CreatedAt, 126) AS CreatedAt,
          CONVERT(VARCHAR(19), INSERTED.UpdatedAt, 126) AS UpdatedAt
        VALUES (@requirementNumber, @projectId, @title, @description, @category, @priority, @createdByUserId)
      `);
    const row = insertResult.recordset[0];

    for (const testCaseId of testCaseIds) {
      const linkRequest = new sql.Request(transaction);
      await linkRequest
        .input("requirementId", sql.Int, row.Id)
        .input("testCaseId", sql.Int, testCaseId)
        .query(`
          IF EXISTS (SELECT Id FROM QaTestCases WHERE Id = @testCaseId)
          INSERT INTO QaRequirementTestCases (RequirementId, TestCaseId) VALUES (@requirementId, @testCaseId)
        `);
    }

    return row;
  });

  await logAdminAction({ admin: qa, section: "qa", action: "create_requirement", details: requirement.RequirementNumber, req });
  await logQaActivity({ entityType: "Requirement", entityId: requirement.Id, action: "create", userId: qa.userId, newValue: requirement, req });

  return NextResponse.json({ ok: true, data: requirement });
}
