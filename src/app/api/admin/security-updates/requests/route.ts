import { NextRequest, NextResponse } from "next/server";
import { requireSecurityUpdatesPermission, isSecurityUpdatesSession } from "@/lib/requireSecurityUpdatesPermission";
import { listInstallRequests } from "@/lib/securityUpdates/installs";

// Recent install requests (queued / running / finished) with per-update outcomes, optionally for one device.
export async function GET(req: NextRequest) {
  const su = await requireSecurityUpdatesPermission("su_view");
  if (!isSecurityUpdatesSession(su)) return su;
  const deviceId = req.nextUrl.searchParams.get("deviceId");
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "20");
  const data = await listInstallRequests(deviceId && deviceId.length <= 40 ? deviceId : null, Number.isFinite(limit) ? limit : 20);
  return NextResponse.json({ ok: true, data });
}
