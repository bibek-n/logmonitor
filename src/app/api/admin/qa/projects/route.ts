import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import type { QaProjectRow } from "@/lib/qaShared";

export async function GET() {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const db = await getDb();
  const result = await db.query<QaProjectRow>(`
    SELECT Id, Name, Description, IsActive,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt,
      CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
    FROM QaProjects
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
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;

  if (!name) {
    return NextResponse.json({ ok: false, error: "Project name is required." }, { status: 400 });
  }
  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ ok: false, error: `Project name must be ${MAX_NAME_LENGTH} characters or fewer.` }, { status: 400 });
  }
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json({ ok: false, error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.` }, { status: 400 });
  }

  const db = await getDb();
  const result = await db
    .request()
    .input("name", sql.NVarChar, name)
    .input("description", sql.NVarChar, description)
    .input("createdByUserId", sql.Int, qa.userId)
    .query<QaProjectRow>(`
      INSERT INTO QaProjects (Name, Description, CreatedByUserId)
      OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.Description, INSERTED.IsActive,
        CONVERT(VARCHAR(19), INSERTED.CreatedAt, 126) AS CreatedAt,
        CONVERT(VARCHAR(19), INSERTED.UpdatedAt, 126) AS UpdatedAt
      VALUES (@name, @description, @createdByUserId)
    `);
  const project = result.recordset[0];

  await logAdminAction({ admin: qa, section: "qa", action: "create_project", details: name, req });
  await logQaActivity({ entityType: "Project", entityId: project.Id, action: "create", userId: qa.userId, newValue: project, req });

  return NextResponse.json({ ok: true, data: project });
}
