import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isBrowserActivitySession, requireBrowserActivityPermission } from "@/lib/requireBrowserActivityPermission";
import { deleteExcludedDomain } from "@/lib/browserActivity/repository";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ba = await requireBrowserActivityPermission("ba_excluded_domains_manage");
  if (!isBrowserActivitySession(ba)) return ba;

  const { id } = await params;
  await deleteExcludedDomain(Number(id));
  await logAdminAction({ admin: ba, section: "browser-activity", action: "excluded_domain_remove", details: id, req });

  return NextResponse.json({ ok: true });
}
