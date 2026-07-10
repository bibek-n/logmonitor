import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export interface SecuritySettingsData {
  PasswordMinLength: number;
  PasswordRequireUppercase: boolean;
  PasswordRequireNumber: boolean;
  PasswordRequireSymbol: boolean;
  SsoEnabled: boolean;
  SsoProvider: string | null;
  IpWhitelist: string | null;
  SessionTimeoutMinutes: number | null;
  LockoutThreshold: number | null;
  LockoutDurationMinutes: number | null;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query<SecuritySettingsData>`
    SELECT PasswordMinLength, PasswordRequireUppercase, PasswordRequireNumber, PasswordRequireSymbol,
      SsoEnabled, SsoProvider, IpWhitelist, SessionTimeoutMinutes, LockoutThreshold, LockoutDurationMinutes
    FROM SecuritySettings WHERE Id = 1
  `;
  return NextResponse.json({ ok: true, data: result.recordset[0] ?? null });
}

// Config storage only — see the approved plan: enforcement of these policies elsewhere in
// the app (real password-complexity checks, SSO handshake, IP allowlist, session timeout,
// account lockout) is explicitly phase 2.
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const int = (v: unknown) => (Number.isInteger(v) ? v : null);

  const db = await getDb();
  await db
    .request()
    .input("passwordMinLength", sql.Int, Number.isInteger(body.passwordMinLength) ? body.passwordMinLength : 8)
    .input("requireUppercase", sql.Bit, !!body.passwordRequireUppercase)
    .input("requireNumber", sql.Bit, !!body.passwordRequireNumber)
    .input("requireSymbol", sql.Bit, !!body.passwordRequireSymbol)
    .input("ssoEnabled", sql.Bit, !!body.ssoEnabled)
    .input("ssoProvider", sql.NVarChar, str(body.ssoProvider))
    .input("ipWhitelist", sql.NVarChar, str(body.ipWhitelist))
    .input("sessionTimeoutMinutes", sql.Int, int(body.sessionTimeoutMinutes))
    .input("lockoutThreshold", sql.Int, int(body.lockoutThreshold))
    .input("lockoutDurationMinutes", sql.Int, int(body.lockoutDurationMinutes))
    .input("updatedByUserId", sql.Int, admin.userId)
    .query(`
      UPDATE SecuritySettings SET
        PasswordMinLength = @passwordMinLength, PasswordRequireUppercase = @requireUppercase,
        PasswordRequireNumber = @requireNumber, PasswordRequireSymbol = @requireSymbol,
        SsoEnabled = @ssoEnabled, SsoProvider = @ssoProvider, IpWhitelist = @ipWhitelist,
        SessionTimeoutMinutes = @sessionTimeoutMinutes, LockoutThreshold = @lockoutThreshold,
        LockoutDurationMinutes = @lockoutDurationMinutes,
        UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @updatedByUserId
      WHERE Id = 1
    `);

  await logAdminAction({ admin, section: "security", action: "update_security_settings", req });

  return NextResponse.json({ ok: true });
}
