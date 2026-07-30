import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isBrowserActivitySession, requireBrowserActivityPermission } from "@/lib/requireBrowserActivityPermission";
import { createCategoryRuleSchema } from "@/lib/browserActivity/schema";
import { createCategoryRule, listCategoryRules } from "@/lib/browserActivity/repository";

export async function GET() {
  const ba = await requireBrowserActivityPermission("ba_view");
  if (!isBrowserActivitySession(ba)) return ba;

  const rules = await listCategoryRules();
  return NextResponse.json({ ok: true, data: rules });
}

export async function POST(req: NextRequest) {
  const ba = await requireBrowserActivityPermission("ba_categories_manage");
  if (!isBrowserActivitySession(ba)) return ba;

  const body = await req.json().catch(() => null);
  const parsed = createCategoryRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rule" }, { status: 400 });
  }

  const id = await createCategoryRule({ ...parsed.data, createdByUserId: ba.userId });
  await logAdminAction({ admin: ba, section: "browser-activity", action: "category_rule_create", details: parsed.data.domain, req });

  return NextResponse.json({ ok: true, data: { id } });
}
