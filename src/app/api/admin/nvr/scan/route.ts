import { NextResponse } from "next/server";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { discoverOnvifDevices } from "@/lib/nvrDiscovery";

// Always responds 200 (see other admin routes in this app for why). WS-Discovery only
// finds devices on the same subnet/broadcast domain as this server — it can't reach across
// VLANs or routed networks, same limitation as any ONVIF discovery tool.
export async function POST() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  try {
    const devices = await discoverOnvifDevices();
    return NextResponse.json({ ok: true, devices });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Scan failed", devices: [] });
  }
}
