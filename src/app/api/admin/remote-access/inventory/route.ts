import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { createInventoryDeviceSchema } from "@/lib/remoteAccess/schema";
import { createInventoryDevice, listInventoryDevices } from "@/lib/remoteAccess/repository";

export async function GET() {
  const ra = await requireRemoteAccessPermission("ra_view");
  if (!isRemoteAccessSession(ra)) return ra;

  return NextResponse.json({ ok: true, data: await listInventoryDevices() });
}

export async function POST(req: NextRequest) {
  const ra = await requireRemoteAccessPermission("ra_connections_create");
  if (!isRemoteAccessSession(ra)) return ra;

  const body = await req.json().catch(() => null);
  const parsed = createInventoryDeviceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid inventory payload" }, { status: 400 });
  }

  const id = await createInventoryDevice(parsed.data, ra.userId);
  await logAdminAction({ admin: ra, section: "remote-access", action: "inventory_create", details: parsed.data.deviceName, req });
  return NextResponse.json({ ok: true, data: { id } });
}
