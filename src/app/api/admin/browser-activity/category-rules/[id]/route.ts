import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isBrowserActivitySession, requireBrowserActivityPermission } from "@/lib/requireBrowserActivityPermission";
import { deleteCategoryRule } from "@/lib/browserActivity/repository";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ba = await requireBrowserActivityPermission("ba_categories_manage");
  if (!isBrowserActivitySession(ba)) return ba;

  const { id } = await params;
  await deleteCategoryRule(Number(id));
  await logAdminAction({ admin: ba, section: "browser-activity", action: "category_rule_delete", details: id, req });

  return NextResponse.json({ ok: true });
}
