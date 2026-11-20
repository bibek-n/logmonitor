import { NextRequest, NextResponse } from "next/server";
import { isSecurityCenterSession, requireSecurityCenterPermission } from "@/lib/requireSecurityCenterPermission";
import { getSecurityCenterOverview } from "@/lib/securityCenter/overview";

export async function GET(req: NextRequest) {
  const sc = await requireSecurityCenterPermission("sc_view");
  if (!isSecurityCenterSession(sc)) return sc;

  const daysParam = Number(req.nextUrl.searchParams.get("trendDays"));
  const trendDays = daysParam === 30 || daysParam === 90 ? daysParam : 7;

  const overview = await getSecurityCenterOverview(trendDays);
  return NextResponse.json({ ok: true, data: overview });
}
