import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isSecurityCenterSession, requireSecurityCenterPermission } from "@/lib/requireSecurityCenterPermission";
import { updateWafCountryRuleSchema } from "@/lib/securityCenter/schema";
import { deleteCountryRule, updateCountryRule } from "@/lib/securityCenter/repository";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sc = await requireSecurityCenterPermission("sc_waf_manage");
  if (!isSecurityCenterSession(sc)) return sc;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateWafCountryRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid country rule" }, { status: 400 });
  }

  try {
    await updateCountryRule(Number(id), parsed.data);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Update failed" }, { status: 400 });
  }

  await logAdminAction({ admin: sc, section: "security-center", action: "waf_country_rule_update", details: `Rule #${id}`, req });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sc = await requireSecurityCenterPermission("sc_waf_manage");
  if (!isSecurityCenterSession(sc)) return sc;

  const { id } = await params;
  await deleteCountryRule(Number(id));
  await logAdminAction({ admin: sc, section: "security-center", action: "waf_country_rule_delete", details: `Rule #${id}`, req });
  return NextResponse.json({ ok: true });
}
