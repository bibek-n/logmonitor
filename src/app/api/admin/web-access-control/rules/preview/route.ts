import { NextRequest, NextResponse } from "next/server";
import { isWebAccessControlSession, requireWebAccessControlPermission } from "@/lib/requireWebAccessControlPermission";
import { previewAccessSchema } from "@/lib/webAccessControl/schema";
import { loadRulesEngineData, getStaffGroupId } from "@/lib/webAccessControl/loadData";
import { resolveAccess } from "@/lib/webAccessControl/rulesEngine";

// Read-only simulation of what resolveAccess() would decide for a given (domain, staffId)
// pair against the CURRENT saved rules - lets an admin see conflicts (spec requirement #8:
// "show conflicts to the administrator before deploying a policy") before actually
// enabling/relying on a rule, not just discover them after the fact.
export async function POST(req: NextRequest) {
  const wac = await requireWebAccessControlPermission("wac_view");
  if (!isWebAccessControlSession(wac)) return wac;

  const body = await req.json().catch(() => null);
  const parsed = previewAccessSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid preview payload" }, { status: 400 });

  const [staffGroupId, { rules, allowlist, schedules }] = await Promise.all([
    getStaffGroupId(parsed.data.staffId),
    loadRulesEngineData(),
  ]);

  const resolution = resolveAccess({
    domain: parsed.data.domain,
    staffId: parsed.data.staffId,
    staffGroupId,
    rules,
    allowlist,
    schedules,
  });

  return NextResponse.json({ ok: true, data: resolution });
}
