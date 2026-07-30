import { NextRequest, NextResponse } from "next/server";
import { resolveDeviceChat } from "@/lib/employeeChatAuth";
import { getLatestSessionForDevice, expireIfPastDeadline } from "@/lib/remoteSupport/sessionAuthorization";
import { issueTurnCredential } from "@/lib/remoteSupport/turnCredentials";

// Polled by BOTH chattray (to detect the Pending -> Active transition and start the real
// WebRTC session) and the consent web page's own client-side JS (to switch from "waiting for
// approval" to "active" to "ended" without a page reload). TURN credentials are re-derived
// fresh on every call rather than returned once at approval time - they're just time-limited
// HMAC tokens (see turnCredentials.ts), safe to reissue on demand, which avoids needing any
// mechanism to hand the original respond() call's credentials from the browser tab over to
// the separate chattray process.
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

  let session = await getLatestSessionForDevice(deviceId);
  if (!session) return NextResponse.json({ ok: true, session: null });

  session = await expireIfPastDeadline(session);

  const iceServers = session.Status === "Active" ? issueTurnCredential(session.Id).iceServers : undefined;

  return NextResponse.json({
    ok: true,
    session: {
      sessionId: session.Id,
      status: session.Status,
      permissionsGranted: session.PermissionsGranted,
      terminationReason: session.TerminationReason,
      iceServers,
    },
  });
}
