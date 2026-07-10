import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export interface BrandingData {
  LogoPath: string | null;
  FaviconPath: string | null;
  PrimaryColor: string | null;
  SecondaryColor: string | null;
  LoginBrandingEnabled: boolean;
  LoginTagline: string | null;
  FooterText: string | null;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query<BrandingData>`
    SELECT LogoPath, FaviconPath, PrimaryColor, SecondaryColor, LoginBrandingEnabled, LoginTagline, FooterText
    FROM CompanySettings WHERE Id = 1
  `;
  return NextResponse.json({ ok: true, data: result.recordset[0] ?? null });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const hexColor = (v: unknown) => (typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v) ? v : null);

  const db = await getDb();
  await db
    .request()
    .input("primaryColor", sql.VarChar, hexColor(body.primaryColor))
    .input("secondaryColor", sql.VarChar, hexColor(body.secondaryColor))
    .input("loginBrandingEnabled", sql.Bit, !!body.loginBrandingEnabled)
    .input("loginTagline", sql.NVarChar, str(body.loginTagline))
    .input("footerText", sql.NVarChar, str(body.footerText))
    .input("updatedByUserId", sql.Int, admin.userId)
    .query(`
      UPDATE CompanySettings SET
        PrimaryColor = @primaryColor, SecondaryColor = @secondaryColor, LoginBrandingEnabled = @loginBrandingEnabled,
        LoginTagline = @loginTagline, FooterText = @footerText,
        UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @updatedByUserId
      WHERE Id = 1
    `);

  await logAdminAction({ admin, section: "branding", action: "update_branding", req });

  return NextResponse.json({ ok: true });
}
