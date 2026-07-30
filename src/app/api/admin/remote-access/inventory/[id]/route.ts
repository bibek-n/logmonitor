import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { updateInventoryDeviceSchema } from "@/lib/remoteAccess/schema";
import { deleteInventoryDevice, getInventoryDevice, updateInventoryDevice } from "@/lib/remoteAccess/repository";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_view");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const device = await getInventoryDevice(Number(id));
  if (!device) return NextResponse.json({ ok: false, error: "Device not found" }, { status: 404 });
  return NextResponse.json({ ok: true, data: device });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_connections_edit");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateInventoryDeviceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid inventory payload" }, { status: 400 });
  }

  try {
    await updateInventoryDevice(Number(id), parsed.data, ra.userId);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Update failed" }, { status: 400 });
  }
  await logAdminAction({ admin: ra, section: "remote-access", action: "inventory_update", details: `Device #${id}`, req });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_connections_delete");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  await deleteInventoryDevice(Number(id));
  await logAdminAction({ admin: ra, section: "remote-access", action: "inventory_delete", details: `Device #${id}`, req });
  return NextResponse.json({ ok: true });
}
