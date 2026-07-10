import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { validateCompanyAsset, saveCompanyAsset, deleteCompanyAsset } from "@/lib/companyAssets";
import { logAdminAction } from "@/lib/adminAudit";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const formData = await req.formData().catch(() => null);
  const image = formData?.get("favicon");
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ ok: false, error: "A favicon image is required." }, { status: 400 });
  }
  const validation = validateCompanyAsset(image.name, image.size);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.query<{ FaviconPath: string | null }>`SELECT FaviconPath FROM CompanySettings WHERE Id = 1`;
  const previousPath = existing.recordset[0]?.FaviconPath;

  const buffer = Buffer.from(await image.arrayBuffer());
  const faviconPath = await saveCompanyAsset(buffer, image.name);

  await db
    .request()
    .input("faviconPath", sql.NVarChar, faviconPath)
    .input("updatedByUserId", sql.Int, admin.userId)
    .query("UPDATE CompanySettings SET FaviconPath = @faviconPath, UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @updatedByUserId WHERE Id = 1");

  if (previousPath) await deleteCompanyAsset(previousPath);

  await logAdminAction({ admin, section: "branding", action: "update_favicon", req });

  return NextResponse.json({ ok: true, faviconPath });
}
