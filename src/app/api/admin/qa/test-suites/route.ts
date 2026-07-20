import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import type { QaTestSuiteRow } from "@/lib/qaShared";

const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 1000;

export async function GET(req: NextRequest) {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const projectIdParam = req.nextUrl.searchParams.get("projectId");
  const moduleIdParam = req.nextUrl.searchParams.get("moduleId");
  const includeArchived = req.nextUrl.searchParams.get("includeArchived") === "true";

  const db = await getDb();
  const request = db.request();
  const conditions: string[] = [];

  if (projectIdParam) {
    const projectId = Number(projectIdParam);
    if (!Number.isInteger(projectId)) return NextResponse.json({ ok: false, error: "Invalid projectId." }, { status: 400 });
    request.input("projectId", sql.Int, projectId);
    conditions.push("ProjectId = @projectId");
  }
  if (moduleIdParam) {
    const moduleId = Number(moduleIdParam);
    if (!Number.isInteger(moduleId)) return NextResponse.json({ ok: false, error: "Invalid moduleId." }, { status: 400 });
    request.input("moduleId", sql.Int, moduleId);
    conditions.push("ModuleId = @moduleId");
  }
  if (!includeArchived) {
    conditions.push("Status <> 'Archived'");
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await request.query<QaTestSuiteRow>(`
    SELECT Id, ProjectId, ModuleId, Name, Description, RequirementRef, Status, CreatedByUserId, UpdatedByUserId,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt,
      CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
    FROM QaTestSuites ${where}
    ORDER BY Name ASC
  `);
  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest) {
  const qa = await requireQaPermission("qa_create");
  if (!isQaSession(qa)) return qa;

  const body = await req.json().catch(() => null);
  const projectId = Number(body?.projectId);
  const moduleId = body?.moduleId != null ? Number(body.moduleId) : null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;
  const requirementRef = typeof body?.requirementRef === "string" && body.requirementRef.trim() ? body.requirementRef.trim().slice(0, 200) : null;

  if (!Number.isInteger(projectId)) {
    return NextResponse.json({ ok: false, error: "A valid projectId is required." }, { status: 400 });
  }
  if (moduleId !== null && !Number.isInteger(moduleId)) {
    return NextResponse.json({ ok: false, error: "Invalid moduleId." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ ok: false, error: "Test suite name is required." }, { status: 400 });
  }
  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` }, { status: 400 });
  }
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

  const result = await db
    .request()
    .input("projectId", sql.Int, projectId)
    .input("moduleId", sql.Int, moduleId)
    .input("name", sql.NVarChar, name)
    .input("description", sql.NVarChar, description)
    .input("requirementRef", sql.NVarChar, requirementRef)
    .input("createdByUserId", sql.Int, qa.userId)
    .query<QaTestSuiteRow>(`
      INSERT INTO QaTestSuites (ProjectId, ModuleId, Name, Description, RequirementRef, CreatedByUserId, UpdatedByUserId)
      OUTPUT INSERTED.Id, INSERTED.ProjectId, INSERTED.ModuleId, INSERTED.Name, INSERTED.Description,
        INSERTED.RequirementRef, INSERTED.Status, INSERTED.CreatedByUserId, INSERTED.UpdatedByUserId,
        CONVERT(VARCHAR(19), INSERTED.CreatedAt, 126) AS CreatedAt,
        CONVERT(VARCHAR(19), INSERTED.UpdatedAt, 126) AS UpdatedAt
      VALUES (@projectId, @moduleId, @name, @description, @requirementRef, @createdByUserId, @createdByUserId)
    `);
  const suite = result.recordset[0];

  await logAdminAction({ admin: qa, section: "qa", action: "create_test_suite", details: name, req });
  await logQaActivity({ entityType: "TestSuite", entityId: suite.Id, action: "create", userId: qa.userId, newValue: suite, req });

  return NextResponse.json({ ok: true, data: suite });
}
