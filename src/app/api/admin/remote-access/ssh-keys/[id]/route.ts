import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { deleteSshKey } from "@/lib/remoteAccess/repository";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_ssh_keys_manage");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  await deleteSshKey(Number(id));
  await logAdminAction({ admin: ra, section: "remote-access", action: "ssh_key_delete", details: `SSH Key #${id}`, req });
  return NextResponse.json({ ok: true });
}
