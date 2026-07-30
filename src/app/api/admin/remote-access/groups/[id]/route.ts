import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { updateGroupSchema } from "@/lib/remoteAccess/schema";
import { deleteGroup, updateGroup } from "@/lib/remoteAccess/repository";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_connections_edit");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid group payload" }, { status: 400 });
  }

  try {
    await updateGroup(Number(id), parsed.data, ra.userId);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Update failed" }, { status: 400 });
  }
  await logAdminAction({ admin: ra, section: "remote-access", action: "group_update", details: `Group #${id}`, req });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_connections_delete");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  await deleteGroup(Number(id));
  await logAdminAction({ admin: ra, section: "remote-access", action: "group_delete", details: `Group #${id}`, req });
  return NextResponse.json({ ok: true });
}
