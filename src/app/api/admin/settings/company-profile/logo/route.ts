import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { validateCompanyAsset, saveCompanyAsset, deleteCompanyAsset } from "@/lib/companyAssets";
import { logAdminAction } from "@/lib/adminAudit";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const formData = await req.formData().catch(() => null);
  const image = formData?.get("logo");
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ ok: false, error: "A logo image is required." }, { status: 400 });
  }
  const validation = validateCompanyAsset(image.name, image.size);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.query<{ LogoPath: string | null }>`SELECT LogoPath FROM CompanySettings WHERE Id = 1`;
  const previousPath = existing.recordset[0]?.LogoPath;

  const buffer = Buffer.from(await image.arrayBuffer());
  const logoPath = await saveCompanyAsset(buffer, image.name);

  await db
    .request()
    .input("logoPath", sql.NVarChar, logoPath)
    .input("updatedByUserId", sql.Int, admin.userId)
    .query("UPDATE CompanySettings SET LogoPath = @logoPath, UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @updatedByUserId WHERE Id = 1");

  if (previousPath) await deleteCompanyAsset(previousPath);

  await logAdminAction({ admin, section: "company_profile", action: "update_logo", req });

  return NextResponse.json({ ok: true, logoPath });
}
