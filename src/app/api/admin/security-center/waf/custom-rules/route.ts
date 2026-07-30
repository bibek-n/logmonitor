import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isSecurityCenterSession, requireSecurityCenterPermission } from "@/lib/requireSecurityCenterPermission";
import { createWafCustomRuleSchema } from "@/lib/securityCenter/schema";
import { createCustomRule, listCustomRules } from "@/lib/securityCenter/repository";

export async function GET() {
  const sc = await requireSecurityCenterPermission("sc_view");
  if (!isSecurityCenterSession(sc)) return sc;

  const rules = await listCustomRules();
  return NextResponse.json({ ok: true, data: rules });
}

export async function POST(req: NextRequest) {
  const sc = await requireSecurityCenterPermission("sc_waf_manage");
  if (!isSecurityCenterSession(sc)) return sc;

  const body = await req.json().catch(() => null);
  const parsed = createWafCustomRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid custom rule" }, { status: 400 });
  }

  const id = await createCustomRule(parsed.data);
  await logAdminAction({ admin: sc, section: "security-center", action: "waf_custom_rule_create", details: parsed.data.name, req });

  return NextResponse.json({ ok: true, data: { id } });
}
