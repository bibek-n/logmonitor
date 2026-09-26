import { NextRequest, NextResponse } from "next/server";
import { requireSecurityUpdatesPermission, isSecurityUpdatesSession } from "@/lib/requireSecurityUpdatesPermission";
import { getDeviceDetails } from "@/lib/securityUpdates/queries";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const su = await requireSecurityUpdatesPermission("su_view");
  if (!isSecurityUpdatesSession(su)) return su;

  const { deviceId } = await params;
  try {
    const details = await getDeviceDetails(deviceId);
    if (!details) return NextResponse.json({ ok: false, error: "Device not found" }, { status: 404 });
    return NextResponse.json({ ok: true, data: details });
  } catch (err) {
    console.error("security-updates device details failed", err);
    return NextResponse.json({ ok: false, error: "Failed to load device details" });
  }
}
