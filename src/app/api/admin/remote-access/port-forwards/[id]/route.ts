import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { deletePortForward } from "@/lib/remoteAccess/repository";
import { isPortForwardActive, stopPortForward } from "@/lib/remoteAccess/portForwardService";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_port_forwarding_manage");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const forwardId = Number(id);
  if (isPortForwardActive(forwardId)) await stopPortForward(forwardId, ra.userId);
  await deletePortForward(forwardId);
  await logAdminAction({ admin: ra, section: "remote-access", action: "port_forward_delete", details: `#${forwardId}`, req });
  return NextResponse.json({ ok: true });
}
