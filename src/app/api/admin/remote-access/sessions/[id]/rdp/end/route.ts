import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { writeAuditEvent } from "@/lib/remoteAccess/auditLog";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { endRdpSession, getRdpSessionOwner } from "@/lib/remoteAccess/rdpSessionService";

// Mirrors sessions/[id]/vnc/end/route.ts for RDP sessions.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_rdp_start");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const sessionId = Number(id);
  const owner = getRdpSessionOwner(sessionId);
  const terminatingOthersSession = owner !== null && owner !== ra.userId;

  await endRdpSession(sessionId, "Terminated");
  await writeAuditEvent({
    eventType: "SessionDisconnected",
    userId: ra.userId,
    username: ra.username,
    sessionId,
    action: terminatingOthersSession ? `Terminated another user's RDP session (owner user #${owner})` : "Terminated own RDP session",
    result: "Success",
  });
  await logAdminAction({ admin: ra, section: "remote-access", action: "rdp_session_terminate", details: `Session #${id}${terminatingOthersSession ? " (another user's session)" : ""}`, req });

  return NextResponse.json({ ok: true });
}
