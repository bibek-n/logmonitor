import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isBrowserActivitySession, requireBrowserActivityPermission } from "@/lib/requireBrowserActivityPermission";
import { updateCategorySchema } from "@/lib/browserActivity/schema";
import { deleteCategory, updateCategory } from "@/lib/browserActivity/repository";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ba = await requireBrowserActivityPermission("ba_categories_manage");
  if (!isBrowserActivitySession(ba)) return ba;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid category" }, { status: 400 });
  }

  await updateCategory(Number(id), parsed.data);
  await logAdminAction({ admin: ba, section: "browser-activity", action: "category_update", details: id, req });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ba = await requireBrowserActivityPermission("ba_categories_manage");
  if (!isBrowserActivitySession(ba)) return ba;

  const { id } = await params;
  await deleteCategory(Number(id));
  await logAdminAction({ admin: ba, section: "browser-activity", action: "category_delete", details: id, req });

  return NextResponse.json({ ok: true });
}
