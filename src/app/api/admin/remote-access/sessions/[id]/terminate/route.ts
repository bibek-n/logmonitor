import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { writeAuditEvent } from "@/lib/remoteAccess/auditLog";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { endSession, getActiveSessionOwner } from "@/lib/remoteAccess/connectionService";

// Client-side confirmation happens before this is ever called; server-side, terminating a
// session you don't own still succeeds for an Admin (matching this app's universal superuser
// convention) but is explicitly logged as such, satisfying "require confirmation before
// terminating another user's session" without silently blocking a legitimate admin override.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_ssh_start");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const sessionId = Number(id);
  const owner = getActiveSessionOwner(sessionId);
  const terminatingOthersSession = owner !== null && owner !== ra.userId;

  await endSession(sessionId, "Terminated");
  await writeAuditEvent({
    eventType: "SessionDisconnected",
    userId: ra.userId,
    username: ra.username,
    sessionId,
    action: terminatingOthersSession ? `Terminated another user's session (owner user #${owner})` : "Terminated own session",
    result: "Success",
  });
  await logAdminAction({ admin: ra, section: "remote-access", action: "session_terminate", details: `Session #${id}${terminatingOthersSession ? " (another user's session)" : ""}`, req });

  return NextResponse.json({ ok: true });
}
