import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { getUserById, validateUserCredentials } from "@/lib/authCore";
import { logAdminAction } from "@/lib/adminAudit";

// Requires the current password (defense in depth, same as every other sensitive
// self-service change) — disabling TOTP immediately falls back that user's next login to
// the emailed OTP code, so this can't be triggered by, say, a stolen/left-open session alone.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password) {
    return NextResponse.json({ ok: false, error: "Current password is required." }, { status: 400 });
  }

  const user = await getUserById(admin.userId);
  if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  const validation = await validateUserCredentials(user.Username, password);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: "Incorrect password." }, { status: 400 });
  }

  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, admin.userId)
    .query("UPDATE Users SET TotpSecretEncrypted = NULL, TotpEnabled = 0, TotpEnrolledAt = NULL WHERE Id = @id");
  await db.request().input("userId", sql.Int, admin.userId).query("DELETE FROM UserTotpRecoveryCodes WHERE UserId = @userId");

  await logAdminAction({ admin, section: "account_security", action: "disable_totp", req });

  return NextResponse.json({ ok: true });
}
