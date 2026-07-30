import { NextRequest, NextResponse } from "next/server";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { checkTcpReachability } from "@/lib/remoteAccess/connectionService";
import { getInventoryDevice } from "@/lib/remoteAccess/repository";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_view");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const device = await getInventoryDevice(Number(id));
  if (!device) return NextResponse.json({ ok: false, error: "Device not found" }, { status: 404 });
  const host = device.hostname || device.ipAddress;
  if (!host) return NextResponse.json({ ok: false, error: "Device has no hostname or IP address" }, { status: 400 });

  // A plain reachability probe on a common management port, not an ICMP ping (Node has no
  // built-in raw-socket ICMP support without native bindings) - close enough for an "is it up"
  // signal in Phase 1.
  const port = device.openManagementPorts[0] ?? (device.operatingSystem === "windows" ? 3389 : 22);
  const result = await checkTcpReachability(host, port, 5000);
  return NextResponse.json({ ok: true, data: result });
}
