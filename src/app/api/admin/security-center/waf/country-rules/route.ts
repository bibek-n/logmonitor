import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isSecurityCenterSession, requireSecurityCenterPermission } from "@/lib/requireSecurityCenterPermission";
import { createWafCountryRuleSchema } from "@/lib/securityCenter/schema";
import { createCountryRule, listCountryRules } from "@/lib/securityCenter/repository";

export async function GET() {
  const sc = await requireSecurityCenterPermission("sc_view");
  if (!isSecurityCenterSession(sc)) return sc;

  const rules = await listCountryRules();
  return NextResponse.json({ ok: true, data: rules });
}

// Logged/informational only in Phase 1 - real per-country enforcement needs a GeoIP-to-CIDR
// mapping this repo doesn't have yet (see the approved plan).
export async function POST(req: NextRequest) {
  const sc = await requireSecurityCenterPermission("sc_waf_manage");
  if (!isSecurityCenterSession(sc)) return sc;

  const body = await req.json().catch(() => null);
  const parsed = createWafCountryRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid country rule" }, { status: 400 });
  }

  const id = await createCountryRule(parsed.data);
  await logAdminAction({ admin: sc, section: "security-center", action: "waf_country_rule_create", details: parsed.data.countryCode, req });

  return NextResponse.json({ ok: true, data: { id } });
}
