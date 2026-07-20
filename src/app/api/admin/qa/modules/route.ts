import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import type { QaModuleRow } from "@/lib/qaShared";

export async function GET(req: NextRequest) {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const projectIdParam = req.nextUrl.searchParams.get("projectId");
  const db = await getDb();
  const request = db.request();

  let where = "";
  if (projectIdParam) {
    const projectId = Number(projectIdParam);
    if (!Number.isInteger(projectId)) {
      return NextResponse.json({ ok: false, error: "Invalid projectId." }, { status: 400 });
    }
    request.input("projectId", sql.Int, projectId);
    where = "WHERE ProjectId = @projectId";
  }

  const result = await request.query<QaModuleRow>(`
    SELECT Id, ProjectId, Name, Description,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt,
      CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
    FROM QaModules ${where}
    ORDER BY Name ASC
  `);
  return NextResponse.json({ ok: true, data: result.recordset });
}

const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 1000;

export async function POST(req: NextRequest) {
  const qa = await requireQaPermission("qa_create");
  if (!isQaSession(qa)) return qa;

  const body = await req.json().catch(() => null);
  const projectId = Number(body?.projectId);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;

  if (!Number.isInteger(projectId)) {
    return NextResponse.json({ ok: false, error: "A valid projectId is required." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ ok: false, error: "Module name is required." }, { status: 400 });
  }
  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ ok: false, error: `Module name must be ${MAX_NAME_LENGTH} characters or fewer.` }, { status: 400 });
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
    .input("name", sql.NVarChar, name)
    .input("description", sql.NVarChar, description)
    .input("createdByUserId", sql.Int, qa.userId)
    .query<QaModuleRow>(`
      INSERT INTO QaModules (ProjectId, Name, Description, CreatedByUserId)
      OUTPUT INSERTED.Id, INSERTED.ProjectId, INSERTED.Name, INSERTED.Description,
        CONVERT(VARCHAR(19), INSERTED.CreatedAt, 126) AS CreatedAt,
        CONVERT(VARCHAR(19), INSERTED.UpdatedAt, 126) AS UpdatedAt
      VALUES (@projectId, @name, @description, @createdByUserId)
    `);
  const module_ = result.recordset[0];

  await logAdminAction({ admin: qa, section: "qa", action: "create_module", details: name, req });
  await logQaActivity({ entityType: "Module", entityId: module_.Id, action: "create", userId: qa.userId, newValue: module_, req });

  return NextResponse.json({ ok: true, data: module_ });
}
