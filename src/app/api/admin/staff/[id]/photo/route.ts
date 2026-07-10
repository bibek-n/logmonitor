import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { validateStaffPhoto, saveStaffPhoto, deleteStaffPhoto } from "@/lib/staffPhotos";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const staffId = Number(id);
  if (!staffId) return NextResponse.json({ ok: false, error: "Invalid staff id" });

  const formData = await req.formData().catch(() => null);
  const photo = formData?.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ ok: false, error: "A photo is required." });
  }
  const validation = validateStaffPhoto(photo.name, photo.size);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error });
  }

  const db = await getDb();
  const existing = await db
    .request()
    .input("id", sql.Int, staffId)
    .query<{ PhotoPath: string | null }>("SELECT PhotoPath FROM Staff WHERE Id = @id");
  const previousPath = existing.recordset[0]?.PhotoPath;

  const buffer = Buffer.from(await photo.arrayBuffer());
  const photoPath = await saveStaffPhoto(buffer, photo.name);

  await db
    .request()
    .input("id", sql.Int, staffId)
    .input("photoPath", sql.NVarChar, photoPath)
    .query("UPDATE Staff SET PhotoPath = @photoPath, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");

  if (previousPath) await deleteStaffPhoto(previousPath);

  return NextResponse.json({ ok: true, photoPath });
}
