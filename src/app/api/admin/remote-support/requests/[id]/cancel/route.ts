import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireRemoteSupportPermission, isRemoteSupportSession } from "@/lib/requireRemoteSupportPermission";
import { logAdminAction } from "@/lib/adminAudit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rs = await requireRemoteSupportPermission("remote_support_request");
  if (!isRemoteSupportSession(rs)) return rs;

  const { id: idParam } = await params;
  const sessionId = Number(idParam);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid session id" }, { status: 400 });
  }

  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, sessionId)
    .input("userId", sql.Int, rs.userId)
    .query(`
      UPDATE RemoteSupportSessions SET Status = 'Rejected', TerminationReason = 'CancelledByRequester'
      WHERE Id = @id AND Status = 'Pending' AND (RequestedByUserId = @userId OR @userId IN (SELECT Id FROM Users WHERE Role = 'Admin'))
    `);

  if ((result.rowsAffected[0] ?? 0) === 0) {
    return NextResponse.json({ ok: false, error: "Request is not pending or does not belong to you" }, { status: 409 });
  }

  await logAdminAction({ admin: rs, section: "remote-support", action: "cancel_request", details: `sessionId=${sessionId}`, req });

  return NextResponse.json({ ok: true });
}
