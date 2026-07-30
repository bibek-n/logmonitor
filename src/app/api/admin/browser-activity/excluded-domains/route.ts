import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isBrowserActivitySession, requireBrowserActivityPermission } from "@/lib/requireBrowserActivityPermission";
import { createExcludedDomainSchema } from "@/lib/browserActivity/schema";
import { createExcludedDomain, listExcludedDomains } from "@/lib/browserActivity/repository";

// The approved "sensitive domain opt-out" list (personal/medical/banking/union/legal/other,
// requirement #12). CRUD here is deliberately gated by ba_excluded_domains_manage, separate
// from ba_categories_manage, so e.g. an HR Reviewer can own this list without also being able
// to reclassify business/social/entertainment categories - see the role grant matrix.
export async function GET() {
  const ba = await requireBrowserActivityPermission("ba_view");
  if (!isBrowserActivitySession(ba)) return ba;

  const domains = await listExcludedDomains();
  return NextResponse.json({ ok: true, data: domains });
}

export async function POST(req: NextRequest) {
  const ba = await requireBrowserActivityPermission("ba_excluded_domains_manage");
  if (!isBrowserActivitySession(ba)) return ba;

  const body = await req.json().catch(() => null);
  const parsed = createExcludedDomainSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid excluded domain" }, { status: 400 });
  }

  const id = await createExcludedDomain({ ...parsed.data, addedByUserId: ba.userId });
  await logAdminAction({ admin: ba, section: "browser-activity", action: "excluded_domain_add", details: parsed.data.domain, req });

  return NextResponse.json({ ok: true, data: { id } });
}
