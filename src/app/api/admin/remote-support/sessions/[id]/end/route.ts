import { NextRequest, NextResponse } from "next/server";
import { requireRemoteSupportPermission, isRemoteSupportSession } from "@/lib/requireRemoteSupportPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { getSessionById, endSession } from "@/lib/remoteSupport/sessionAuthorization";
import { SessionStateError } from "@/lib/remoteSupport/types";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rs = await requireRemoteSupportPermission("remote_support_request");
  if (!isRemoteSupportSession(rs)) return rs;

  const { id: idParam } = await params;
  const sessionId = Number(idParam);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid session id" }, { status: 400 });
  }

  const session = await getSessionById(sessionId);
  if (!session) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
  if (session.RequestedByUserId !== rs.userId && rs.role !== "Admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" && body.reason ? body.reason : "AdminEnded";

  try {
    await endSession({ sessionId, terminationReason: reason, requestedByAdminUserId: rs.userId });
  } catch (err) {
    if (err instanceof SessionStateError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 409 });
    }
    throw err;
  }

  await logAdminAction({ admin: rs, section: "remote-support", action: "end_session", details: `sessionId=${sessionId} reason=${reason}`, req });

  return NextResponse.json({ ok: true });
}
