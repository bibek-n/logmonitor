import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const userId = Number(id);
  const body = await req.json().catch(() => null);
  if (!Number.isInteger(userId) || !body) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  if (userId === admin.userId && body.isActive === false) {
    return NextResponse.json({ ok: false, error: "You cannot deactivate your own account." }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const int = (v: unknown) => (Number.isInteger(v) ? v : null);

  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, userId)
    .input("fullName", sql.NVarChar, str(body.fullName))
    .input("email", sql.NVarChar, str(body.email))
    .input("departmentId", sql.Int, int(body.departmentId))
    .input("teamId", sql.Int, int(body.teamId))
    .input("branchOfficeId", sql.Int, int(body.branchOfficeId))
    .input("jobDesignationId", sql.Int, int(body.jobDesignationId))
    .input("isActive", sql.Bit, body.isActive === false ? false : true)
    .input("mfaRequired", sql.Bit, body.mfaRequired === true)
    .query(`
      UPDATE Users SET
        FullName = @fullName, Email = @email, DepartmentId = @departmentId, TeamId = @teamId,
        BranchOfficeId = @branchOfficeId, JobDesignationId = @jobDesignationId, IsActive = @isActive,
        MfaRequired = @mfaRequired
      WHERE Id = @id
    `);

  await logAdminAction({ admin, section: "users_access", action: "update_user", details: `userId=${userId}`, req });

  return NextResponse.json({ ok: true });
}
