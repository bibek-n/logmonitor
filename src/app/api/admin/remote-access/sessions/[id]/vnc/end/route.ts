import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { writeAuditEvent } from "@/lib/remoteAccess/auditLog";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { endVncSession, getVncSessionOwner } from "@/lib/remoteAccess/vncSessionService";

// Mirrors sessions/[id]/terminate/route.ts (Terminal's disconnect) for VNC sessions.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_vnc_start");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const sessionId = Number(id);
  const owner = getVncSessionOwner(sessionId);
  const terminatingOthersSession = owner !== null && owner !== ra.userId;

  await endVncSession(sessionId, "Terminated");
  await writeAuditEvent({
    eventType: "SessionDisconnected",
    userId: ra.userId,
    username: ra.username,
    sessionId,
    action: terminatingOthersSession ? `Terminated another user's VNC session (owner user #${owner})` : "Terminated own VNC session",
    result: "Success",
  });
  await logAdminAction({ admin: ra, section: "remote-access", action: "vnc_session_terminate", details: `Session #${id}${terminatingOthersSession ? " (another user's session)" : ""}`, req });

  return NextResponse.json({ ok: true });
}
