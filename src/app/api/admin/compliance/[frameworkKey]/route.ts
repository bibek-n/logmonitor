import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

export async function GET(req: NextRequest, { params }: { params: Promise<{ frameworkKey: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { frameworkKey } = await params;

  const db = await getDb();
  const frameworkResult = await db
    .request()
    .input("key", sql.VarChar, frameworkKey)
    .query<{ Id: number; Key: string; Name: string; Description: string | null }>("SELECT Id, [Key], Name, Description FROM ComplianceFrameworks WHERE [Key] = @key");
  const framework = frameworkResult.recordset[0];
  if (!framework) return NextResponse.json({ ok: false, error: "Framework not found." }, { status: 404 });

  const controlsResult = await db
    .request()
    .input("frameworkId", sql.Int, framework.Id)
    .query(`
      SELECT Id, ControlCode, Category, Title, Description, AutoCheckKey, Status, Evidence, Notes,
        CONVERT(VARCHAR(19), ReviewedAt, 126) AS ReviewedAt, AutoCheckStatus, AutoCheckDetail,
        CONVERT(VARCHAR(19), AutoCheckedAt, 126) AS AutoCheckedAt, CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
      FROM ComplianceControls WHERE FrameworkId = @frameworkId ORDER BY SortOrder ASC
    `);

  return NextResponse.json({ ok: true, data: { framework, controls: controlsResult.recordset } });
}
