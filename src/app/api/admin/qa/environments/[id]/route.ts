import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import { type QaEnvironmentRow } from "@/lib/qaShared";

const MAX_NAME_LENGTH = 100;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_edit");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const environmentId = Number(id);
  if (!Number.isInteger(environmentId)) {
    return NextResponse.json({ ok: false, error: "Invalid environment id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const db = await getDb();

  const existingResult = await db.request().input("id", sql.Int, environmentId).query<QaEnvironmentRow>(
    "SELECT * FROM QaEnvironments WHERE Id = @id"
  );
  const existing = existingResult.recordset[0];
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Environment not found." }, { status: 404 });
  }

  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : existing.Name;
  const apiUrl = body?.apiUrl !== undefined ? (typeof body.apiUrl === "string" ? body.apiUrl.trim() || null : null) : existing.ApiUrl;
  const databaseInfo = body?.databaseInfo !== undefined ? (typeof body.databaseInfo === "string" ? body.databaseInfo.trim() || null : null) : existing.DatabaseInfo;
  const buildVersion = body?.buildVersion !== undefined ? (typeof body.buildVersion === "string" ? body.buildVersion.trim() || null : null) : existing.BuildVersion;
  const configNotes = body?.configNotes !== undefined ? (typeof body.configNotes === "string" ? body.configNotes.trim() || null : null) : existing.ConfigNotes;
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : existing.IsActive;

  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` }, { status: 400 });
  }

  await db
    .request()
    .input("id", sql.Int, environmentId)
    .input("name", sql.NVarChar, name)
    .input("apiUrl", sql.NVarChar, apiUrl)
    .input("databaseInfo", sql.NVarChar, databaseInfo)
    .input("buildVersion", sql.NVarChar, buildVersion)
    .input("configNotes", sql.NVarChar, configNotes)
    .input("isActive", sql.Bit, isActive)
    .query(`
      UPDATE QaEnvironments SET Name = @name, ApiUrl = @apiUrl, DatabaseInfo = @databaseInfo,
        BuildVersion = @buildVersion, ConfigNotes = @configNotes, IsActive = @isActive,
        UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id
    `);

  await logAdminAction({ admin: qa, section: "qa", action: "update_environment", details: existing.Name, req });
  await logQaActivity({
    entityType: "Environment", entityId: environmentId, action: "update", userId: qa.userId,
    previousValue: existing, newValue: { name, apiUrl, isActive }, req,
  });

  return NextResponse.json({ ok: true });
}
