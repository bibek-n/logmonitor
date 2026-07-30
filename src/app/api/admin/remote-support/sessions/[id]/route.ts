import { NextRequest, NextResponse } from "next/server";
import { requireRemoteSupportPermission, isRemoteSupportSession } from "@/lib/requireRemoteSupportPermission";
import { getSessionById, expireIfPastDeadline } from "@/lib/remoteSupport/sessionAuthorization";
import { issueTurnCredential } from "@/lib/remoteSupport/turnCredentials";

// Polled by the admin console's session viewer to drive Pending -> Active -> Ended and, once
// Active, to get the ICE servers its own browser-native RTCPeerConnection needs - mirrors
// chat/session/route.ts's employee-side equivalent exactly (re-derive fresh TURN credentials
// on every call rather than only once at approval time).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rs = await requireRemoteSupportPermission("remote_support_request");
  if (!isRemoteSupportSession(rs)) return rs;

  const { id: idParam } = await params;
  const sessionId = Number(idParam);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid session id" }, { status: 400 });
  }

  let session = await getSessionById(sessionId);
  if (!session) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });

  if (session.RequestedByUserId !== rs.userId && rs.role !== "Admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  session = await expireIfPastDeadline(session);

  const iceServers = session.Status === "Active" ? issueTurnCredential(session.Id).iceServers : undefined;

  return NextResponse.json({
    ok: true,
    session: {
      sessionId: session.Id,
      deviceId: session.DeviceId,
      reason: session.Reason,
      status: session.Status,
      permissionsGranted: session.PermissionsGranted,
      requestedAt: session.RequestedAt,
      expiresAt: session.ExpiresAt,
      respondedAt: session.RespondedAt,
      startedAt: session.StartedAt,
      endedAt: session.EndedAt,
      terminationReason: session.TerminationReason,
      iceServers,
    },
  });
}
