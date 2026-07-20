import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import type { QaProjectRow } from "@/lib/qaShared";

const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 1000;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_edit");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isInteger(projectId)) {
    return NextResponse.json({ ok: false, error: "Invalid project id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const db = await getDb();

  const existingResult = await db.request().input("id", sql.Int, projectId).query<QaProjectRow>(
    "SELECT Id, Name, Description, IsActive FROM QaProjects WHERE Id = @id"
  );
  const existing = existingResult.recordset[0];
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
  }

  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : existing.Name;
  const description = typeof body?.description === "string" ? (body.description.trim() || null) : existing.Description;
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : existing.IsActive;

  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ ok: false, error: `Project name must be ${MAX_NAME_LENGTH} characters or fewer.` }, { status: 400 });
  }
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json({ ok: false, error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.` }, { status: 400 });
  }

  await db
    .request()
    .input("id", sql.Int, projectId)
    .input("name", sql.NVarChar, name)
    .input("description", sql.NVarChar, description)
    .input("isActive", sql.Bit, isActive)
    .query(`
      UPDATE QaProjects SET
        Name = @name, Description = @description, IsActive = @isActive, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id
    `);

  await logAdminAction({ admin: qa, section: "qa", action: "update_project", details: name, req });
  await logQaActivity({
    entityType: "Project", entityId: projectId, action: "update", userId: qa.userId,
    previousValue: existing, newValue: { Name: name, Description: description, IsActive: isActive }, req,
  });

  return NextResponse.json({ ok: true });
}
