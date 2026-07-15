import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

// Self-service password change (the existing /api/admin/settings/users/[id]/password
// route is admin-resets-someone-else's-password and has no "prove you know the current
// one" check - appropriate there since it's already gated on admin session, but a
// self-service change needs the current-password check to stop a hijacked/left-open
// session from being used to lock the real owner out).
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (newPassword.length < 8) {
    return NextResponse.json({ ok: false, error: "New password must be at least 8 characters." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, admin.userId).query<{ PasswordHash: string }>(
    "SELECT PasswordHash FROM Users WHERE Id = @id"
  );
  const row = result.recordset[0];
  if (!row) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  const matches = await bcrypt.compare(currentPassword, row.PasswordHash);
  if (!matches) {
    return NextResponse.json({ ok: false, error: "Current password is incorrect." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db
    .request()
    .input("id", sql.Int, admin.userId)
    .input("passwordHash", sql.NVarChar, passwordHash)
    .query("UPDATE Users SET PasswordHash = @passwordHash, PasswordChangedAt = SYSUTCDATETIME() WHERE Id = @id");

  await logAdminAction({ admin, section: "account_security", action: "change_own_password", details: "", req });

  return NextResponse.json({ ok: true });
}
