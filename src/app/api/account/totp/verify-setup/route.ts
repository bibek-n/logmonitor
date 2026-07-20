import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { validateTotpCode, encryptTotpSecret, generateRecoveryCodes } from "@/lib/totp";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const secret = typeof body?.secret === "string" ? body.secret : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!secret || !code) {
    return NextResponse.json({ ok: false, error: "Missing secret or code." }, { status: 400 });
  }

  if (!validateTotpCode(secret, code)) {
    return NextResponse.json({ ok: false, error: "That code didn't match — check the app and try again." }, { status: 400 });
  }

  const encrypted = encryptTotpSecret(secret);
  const { plaintext: recoveryCodes, hashes } = await generateRecoveryCodes();

  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, admin.userId)
    .input("secret", sql.NVarChar, encrypted)
    .query("UPDATE Users SET TotpSecretEncrypted = @secret, TotpEnabled = 1, TotpEnrolledAt = SYSUTCDATETIME() WHERE Id = @id");

  // Replace-in-full: a fresh enrollment always starts with a clean set of recovery codes.
  await db.request().input("userId", sql.Int, admin.userId).query("DELETE FROM UserTotpRecoveryCodes WHERE UserId = @userId");
  for (const hash of hashes) {
    await db.request().input("userId", sql.Int, admin.userId).input("hash", sql.NVarChar, hash)
      .query("INSERT INTO UserTotpRecoveryCodes (UserId, CodeHash) VALUES (@userId, @hash)");
  }

  await logAdminAction({ admin, section: "account_security", action: "enable_totp", req });

  return NextResponse.json({ ok: true, recoveryCodes });
}
