import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { getUserById, validateUserCredentials } from "@/lib/authCore";
import { logAdminAction } from "@/lib/adminAudit";
import { generateRecoveryCodes } from "@/lib/totp";

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
  if (!validation.user.TotpEnabled) {
    return NextResponse.json({ ok: false, error: "Authenticator app is not enabled." }, { status: 400 });
  }

  const { plaintext: recoveryCodes, hashes } = await generateRecoveryCodes();

  const db = await getDb();
  await db.request().input("userId", sql.Int, admin.userId).query("DELETE FROM UserTotpRecoveryCodes WHERE UserId = @userId");
  for (const hash of hashes) {
    await db.request().input("userId", sql.Int, admin.userId).input("hash", sql.NVarChar, hash)
      .query("INSERT INTO UserTotpRecoveryCodes (UserId, CodeHash) VALUES (@userId, @hash)");
  }

  await logAdminAction({ admin, section: "account_security", action: "regenerate_totp_recovery_codes", req });

  return NextResponse.json({ ok: true, recoveryCodes });
}
