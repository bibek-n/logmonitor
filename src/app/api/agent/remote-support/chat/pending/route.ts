import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { resolveDeviceChat } from "@/lib/employeeChatAuth";
import { getPendingSessionForDevice, expireIfPastDeadline } from "@/lib/remoteSupport/sessionAuthorization";

// Polled by chattray (agent/chattray, not the main agent service - see the same reasoning as
// chat-unread/route.ts: only a process in the user's own desktop session can show UI, so the
// whole Remote Support consent/live-session flow authenticates with the low-privilege
// ChatToken, never the device's full API key). This route is a pure peek used to decide
// whether to launch the consent browser tab at all.
export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get("deviceId");
  const token = req.nextUrl.searchParams.get("token");
  if (!deviceId) {
    return NextResponse.json({ ok: false, error: "Missing deviceId" });
  }

  const device = await resolveDeviceChat(deviceId, token);
  if (!device) {
    return NextResponse.json({ ok: true, session: null });
  }

  let session = await getPendingSessionForDevice(deviceId);
  if (!session) return NextResponse.json({ ok: true, session: null });

  session = await expireIfPastDeadline(session);
  if (session.Status !== "Pending") return NextResponse.json({ ok: true, session: null });

  const db = await getDb();
  const adminResult = await db
    .request()
    .input("id", sql.Int, session.RequestedByUserId)
    .query<{ Username: string; FullName: string | null }>("SELECT Username, FullName FROM Users WHERE Id = @id");
  const admin = adminResult.recordset[0];

  return NextResponse.json({
    ok: true,
    session: {
      sessionId: session.Id,
      adminName: admin?.FullName || admin?.Username || "An administrator",
      reason: session.Reason,
      expiresAt: session.ExpiresAt,
      permissionsRequested: session.PermissionsGranted,
      // Echoed straight back on the respond() call below - ChatToken already proves "this is
      // the legitimate companion for this device," so exposing it here doesn't grant anything
      // beyond what that already does; the nonce is what respondToSessionRequest() then
      // independently re-checks against live DB state before honoring the decision.
      nonce: session.ApprovalNonce,
    },
  });
}
