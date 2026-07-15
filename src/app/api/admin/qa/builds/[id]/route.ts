import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import { VALID_BUILD_STATUSES, type QaBuildRow } from "@/lib/qaShared";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_edit");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const buildId = Number(id);
  if (!Number.isInteger(buildId)) {
    return NextResponse.json({ ok: false, error: "Invalid build id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const db = await getDb();

  const existingResult = await db.request().input("id", sql.Int, buildId).query<QaBuildRow>(
    "SELECT * FROM QaBuilds WHERE Id = @id"
  );
  const existing = existingResult.recordset[0];
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Build not found." }, { status: 404 });
  }

  const status = typeof body?.status === "string" && VALID_BUILD_STATUSES.has(body.status) ? body.status : existing.Status;
  const environmentId = body?.environmentId !== undefined ? (body.environmentId === null ? null : Number(body.environmentId)) : existing.EnvironmentId;
  const gitCommit = body?.gitCommit !== undefined ? (typeof body.gitCommit === "string" ? body.gitCommit.trim() || null : null) : existing.GitCommit;
  const branch = body?.branch !== undefined ? (typeof body.branch === "string" ? body.branch.trim() || null : null) : existing.Branch;

  if (environmentId !== null && !Number.isInteger(environmentId)) {
    return NextResponse.json({ ok: false, error: "Invalid environmentId." }, { status: 400 });
  }

  await db
    .request()
    .input("id", sql.Int, buildId)
    .input("status", sql.VarChar, status)
    .input("environmentId", sql.Int, environmentId)
    .input("gitCommit", sql.NVarChar, gitCommit)
    .input("branch", sql.NVarChar, branch)
    .query(`
      UPDATE QaBuilds SET Status = @status, EnvironmentId = @environmentId, GitCommit = @gitCommit, Branch = @branch
      WHERE Id = @id
    `);

  await logAdminAction({ admin: qa, section: "qa", action: "update_build", details: existing.BuildNumber, req });
  await logQaActivity({
    entityType: "Build", entityId: buildId, action: "update", userId: qa.userId,
    previousValue: existing, newValue: { status, environmentId }, req,
  });

  return NextResponse.json({ ok: true });
}
