import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isBrowserActivitySession, requireBrowserActivityPermission } from "@/lib/requireBrowserActivityPermission";
import { createCategorySchema } from "@/lib/browserActivity/schema";
import { createCategory, listCategories, listCategoryRules } from "@/lib/browserActivity/repository";

export async function GET() {
  const ba = await requireBrowserActivityPermission("ba_view");
  if (!isBrowserActivitySession(ba)) return ba;

  const [categories, rules] = await Promise.all([listCategories(), listCategoryRules()]);
  return NextResponse.json({ ok: true, data: { categories, rules } });
}

export async function POST(req: NextRequest) {
  const ba = await requireBrowserActivityPermission("ba_categories_manage");
  if (!isBrowserActivitySession(ba)) return ba;

  const body = await req.json().catch(() => null);
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid category" }, { status: 400 });
  }

  const id = await createCategory(parsed.data);
  await logAdminAction({ admin: ba, section: "browser-activity", action: "category_create", details: parsed.data.name, req });

  return NextResponse.json({ ok: true, data: { id } });
}
