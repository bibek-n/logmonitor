import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isSecurityCenterSession, requireSecurityCenterPermission } from "@/lib/requireSecurityCenterPermission";
import { createWafRateLimitRuleSchema } from "@/lib/securityCenter/schema";
import { createRateLimitRule, listRateLimitRules } from "@/lib/securityCenter/repository";

export async function GET() {
  const sc = await requireSecurityCenterPermission("sc_view");
  if (!isSecurityCenterSession(sc)) return sc;

  const rules = await listRateLimitRules();
  return NextResponse.json({ ok: true, data: rules });
}

// Phase 1: configuration + logging only, not live request-path enforcement (see the approved
// plan for why - this app's only existing rate limiter is a narrow, per-user, in-memory
// primitive built for one low-volume endpoint; wiring broad IP-keyed enforcement into
// middleware.ts is deliberately deferred rather than rushed into the same app pool serving
// this dashboard).
export async function POST(req: NextRequest) {
  const sc = await requireSecurityCenterPermission("sc_waf_manage");
  if (!isSecurityCenterSession(sc)) return sc;

  const body = await req.json().catch(() => null);
  const parsed = createWafRateLimitRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rate limit rule" }, { status: 400 });
  }

  const id = await createRateLimitRule(parsed.data);
  await logAdminAction({ admin: sc, section: "security-center", action: "waf_rate_limit_rule_create", details: parsed.data.name, req });

  return NextResponse.json({ ok: true, data: { id } });
}
