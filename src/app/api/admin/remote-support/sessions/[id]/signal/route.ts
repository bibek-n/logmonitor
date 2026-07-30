import { NextRequest, NextResponse } from "next/server";
import { requireRemoteSupportPermission, isRemoteSupportSession } from "@/lib/requireRemoteSupportPermission";
import { getSessionById } from "@/lib/remoteSupport/sessionAuthorization";
import { enqueueSignalMessage, pollSignalMessages } from "@/lib/remoteSupport/signalingRelay";
import type { SignalMessageType } from "@/lib/remoteSupport/types";

const VALID_MESSAGE_TYPES: SignalMessageType[] = ["offer", "answer", "ice-candidate"];

async function loadOwnedSession(sessionId: number, userId: number, role: string) {
  const session = await getSessionById(sessionId);
  if (!session) return { error: NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 }) };
  if (session.RequestedByUserId !== userId && role !== "Admin") {
    return { error: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

// Admin writes into ToAgent, reads from ToAdmin - the agent side does the mirror image. The
// signaling channel only accepts messages while the session is Approved/Active: a Pending
// session has no peer connection to negotiate yet, and an Ended one shouldn't accept new
// offers a stale browser tab might still try to send.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rs = await requireRemoteSupportPermission("remote_support_request");
  if (!isRemoteSupportSession(rs)) return rs;

  const { id: idParam } = await params;
  const sessionId = Number(idParam);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid session id" }, { status: 400 });
  }

  const { session, error } = await loadOwnedSession(sessionId, rs.userId, rs.role);
  if (error) return error;
  if (!["Approved", "Active"].includes(session.Status)) {
    return NextResponse.json({ ok: false, error: "Session is not open for signaling" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const messageType = body?.type;
  const payload = body?.payload;
  if (!VALID_MESSAGE_TYPES.includes(messageType) || typeof payload !== "string" || !payload) {
    return NextResponse.json({ ok: false, error: "Invalid signal message" }, { status: 400 });
  }

  await enqueueSignalMessage(sessionId, "ToAgent", messageType, payload);
  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rs = await requireRemoteSupportPermission("remote_support_request");
  if (!isRemoteSupportSession(rs)) return rs;

  const { id: idParam } = await params;
  const sessionId = Number(idParam);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid session id" }, { status: 400 });
  }

  const { session, error } = await loadOwnedSession(sessionId, rs.userId, rs.role);
  if (error) return error;
  if (session.Status === "Ended" || session.Status === "Rejected" || session.Status === "Expired") {
    return NextResponse.json({ ok: false, error: "Session has ended", messages: [] }, { status: 410 });
  }

  const messages = await pollSignalMessages(sessionId, "ToAdmin");
  return NextResponse.json({ ok: true, messages });
}
