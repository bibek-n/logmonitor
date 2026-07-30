import { NextResponse } from "next/server";
import { isSecurityCenterSession, requireSecurityCenterPermission } from "@/lib/requireSecurityCenterPermission";
import { getSecurityCenterOverview } from "@/lib/securityCenter/overview";

export async function GET() {
  const sc = await requireSecurityCenterPermission("sc_view");
  if (!isSecurityCenterSession(sc)) return sc;

  const overview = await getSecurityCenterOverview();
  return NextResponse.json({ ok: true, data: overview });
}
