import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { validateSliderImage, saveSliderImage } from "@/lib/sliderImages";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ ok: false, error: "Invalid form submission" }, { status: 400 });
  }

  const image = formData.get("image");
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ ok: false, error: "A slide image is required." }, { status: 400 });
  }
  const validation = validateSliderImage(image.name, image.size);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  const title = String(formData.get("title") ?? "").trim() || null;
  const subtitle = String(formData.get("subtitle") ?? "").trim() || null;
  const buttonText = String(formData.get("buttonText") ?? "").trim() || null;
  const buttonUrl = String(formData.get("buttonUrl") ?? "").trim() || null;
  const publishStartAt = String(formData.get("publishStartAt") ?? "").trim() || null;
  const publishEndAt = String(formData.get("publishEndAt") ?? "").trim() || null;

  const buffer = Buffer.from(await image.arrayBuffer());
  const imagePath = await saveSliderImage(buffer, image.name);

  const db = await getDb();
  const maxOrderResult = await db.query<{ MaxOrder: number | null }>("SELECT MAX(SortOrder) AS MaxOrder FROM SliderImages");
  const nextOrder = (maxOrderResult.recordset[0]?.MaxOrder ?? -1) + 1;

  await db
    .request()
    .input("title", sql.NVarChar, title)
    .input("subtitle", sql.NVarChar, subtitle)
    .input("buttonText", sql.NVarChar, buttonText)
    .input("buttonUrl", sql.NVarChar, buttonUrl)
    .input("imagePath", sql.NVarChar, imagePath)
    .input("sortOrder", sql.Int, nextOrder)
    .input("publishStartAt", sql.DateTime2, publishStartAt)
    .input("publishEndAt", sql.DateTime2, publishEndAt)
    .query(`
      INSERT INTO SliderImages (Title, Subtitle, ButtonText, ButtonUrl, ImagePath, SortOrder, Enabled, PublishStartAt, PublishEndAt)
      VALUES (@title, @subtitle, @buttonText, @buttonUrl, @imagePath, @sortOrder, 1, @publishStartAt, @publishEndAt)
    `);

  return NextResponse.json({ ok: true });
}
