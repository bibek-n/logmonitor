import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { getPasskeysForUser } from "@/lib/webauthn";
import { logAdminAction } from "@/lib/adminAudit";

interface SecurityProfileRow {
  MfaRequired: boolean;
  PasswordChangedAt: string | null;
  RecoveryPhone: string | null;
  RecoveryEmail: string | null;
  SkipPasswordWhenPossible: boolean;
}

// Self-service account security checklist (2-Step Verification status, password
// last-changed, recovery contacts, passkey count) - scoped to the logged-in user's own
// row, never another user's. Distinct from SecuritySection, which is org-wide policy
// config, and from the admin-on-behalf-of-another-user routes under
// /api/admin/settings/users/[id]/*.
export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, admin.userId)
    .query<SecurityProfileRow>(
      "SELECT MfaRequired, PasswordChangedAt, RecoveryPhone, RecoveryEmail, SkipPasswordWhenPossible FROM Users WHERE Id = @id"
    );
  const row = result.recordset[0];
  if (!row) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  const passkeys = await getPasskeysForUser(admin.userId);

  return NextResponse.json({
    ok: true,
    mfaRequired: row.MfaRequired,
    passwordChangedAt: row.PasswordChangedAt,
    recoveryPhone: row.RecoveryPhone,
    recoveryEmail: row.RecoveryEmail,
    skipPasswordWhenPossible: row.SkipPasswordWhenPossible,
    passkeyCount: passkeys.length,
  });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const updates: string[] = [];
  const request = (await getDb()).request().input("id", sql.Int, admin.userId);
  const changedFields: string[] = [];

  if ("mfaRequired" in body) {
    request.input("mfaRequired", sql.Bit, Boolean(body.mfaRequired));
    updates.push("MfaRequired = @mfaRequired, MfaEnrolledAt = CASE WHEN @mfaRequired = 1 THEN SYSUTCDATETIME() ELSE NULL END");
    changedFields.push(`mfaRequired=${Boolean(body.mfaRequired)}`);
  }
  if ("skipPasswordWhenPossible" in body) {
    request.input("skipPasswordWhenPossible", sql.Bit, Boolean(body.skipPasswordWhenPossible));
    updates.push("SkipPasswordWhenPossible = @skipPasswordWhenPossible");
    changedFields.push(`skipPasswordWhenPossible=${Boolean(body.skipPasswordWhenPossible)}`);
  }
  if ("recoveryPhone" in body) {
    const phone = typeof body.recoveryPhone === "string" ? body.recoveryPhone.trim().slice(0, 30) : null;
    request.input("recoveryPhone", sql.NVarChar, phone || null);
    updates.push("RecoveryPhone = @recoveryPhone");
    changedFields.push("recoveryPhone");
  }
  if ("recoveryEmail" in body) {
    const email = typeof body.recoveryEmail === "string" ? body.recoveryEmail.trim().slice(0, 200) : null;
    request.input("recoveryEmail", sql.NVarChar, email || null);
    updates.push("RecoveryEmail = @recoveryEmail");
    changedFields.push("recoveryEmail");
  }

  if (updates.length === 0) {
    return NextResponse.json({ ok: false, error: "No fields to update" }, { status: 400 });
  }

  await request.query(`UPDATE Users SET ${updates.join(", ")} WHERE Id = @id`);
  await logAdminAction({ admin, section: "account_security", action: "update_profile", details: changedFields.join(", "), req });

  return NextResponse.json({ ok: true });
}
