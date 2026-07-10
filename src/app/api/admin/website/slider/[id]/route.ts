import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { validateSliderImage, saveSliderImage, deleteSliderImage } from "@/lib/sliderImages";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const slideId = Number(id);
  if (!Number.isInteger(slideId)) {
    return NextResponse.json({ ok: false, error: "Invalid slide id" }, { status: 400 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ ok: false, error: "Invalid form submission" }, { status: 400 });
  }

  const db = await getDb();
  const existingResult = await db.request().input("id", sql.Int, slideId).query<{ ImagePath: string }>(
    "SELECT ImagePath FROM SliderImages WHERE Id = @id"
  );
  const existing = existingResult.recordset[0];
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Slide not found" }, { status: 404 });
  }

  let imagePath = existing.ImagePath;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    const validation = validateSliderImage(image.name, image.size);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
    }
    const buffer = Buffer.from(await image.arrayBuffer());
    const newPath = await saveSliderImage(buffer, image.name);
    await deleteSliderImage(imagePath);
    imagePath = newPath;
  }

  const title = String(formData.get("title") ?? "").trim() || null;
  const subtitle = String(formData.get("subtitle") ?? "").trim() || null;
  const buttonText = String(formData.get("buttonText") ?? "").trim() || null;
  const buttonUrl = String(formData.get("buttonUrl") ?? "").trim() || null;
  const enabled = formData.get("enabled") === "true";
  const publishStartAt = String(formData.get("publishStartAt") ?? "").trim() || null;
  const publishEndAt = String(formData.get("publishEndAt") ?? "").trim() || null;

  await db
    .request()
    .input("id", sql.Int, slideId)
    .input("title", sql.NVarChar, title)
    .input("subtitle", sql.NVarChar, subtitle)
    .input("buttonText", sql.NVarChar, buttonText)
    .input("buttonUrl", sql.NVarChar, buttonUrl)
    .input("imagePath", sql.NVarChar, imagePath)
    .input("enabled", sql.Bit, enabled)
    .input("publishStartAt", sql.DateTime2, publishStartAt)
    .input("publishEndAt", sql.DateTime2, publishEndAt)
    .query(`
      UPDATE SliderImages SET
        Title = @title, Subtitle = @subtitle, ButtonText = @buttonText, ButtonUrl = @buttonUrl,
        ImagePath = @imagePath, Enabled = @enabled, PublishStartAt = @publishStartAt,
        PublishEndAt = @publishEndAt, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id
    `);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const slideId = Number(id);
  if (!Number.isInteger(slideId)) {
    return NextResponse.json({ ok: false, error: "Invalid slide id" }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, slideId).query<{ ImagePath: string }>(
    "SELECT ImagePath FROM SliderImages WHERE Id = @id"
  );
  const slide = result.recordset[0];
  if (!slide) {
    return NextResponse.json({ ok: false, error: "Slide not found" }, { status: 404 });
  }

  await deleteSliderImage(slide.ImagePath);
  await db.request().input("id", sql.Int, slideId).query("DELETE FROM SliderImages WHERE Id = @id");

  return NextResponse.json({ ok: true });
}
