import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { writeAuditEvent } from "@/lib/remoteAccess/auditLog";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { stopPortForward } from "@/lib/remoteAccess/portForwardService";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_port_forwarding_manage");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const forwardId = Number(id);
  await stopPortForward(forwardId, ra.userId);
  await writeAuditEvent({ eventType: "PortForwardingStopped", userId: ra.userId, username: ra.username, action: `Port forward #${forwardId}`, result: "Success" });
  await logAdminAction({ admin: ra, section: "remote-access", action: "port_forward_stop", details: `#${forwardId}`, req });
  return NextResponse.json({ ok: true });
}
