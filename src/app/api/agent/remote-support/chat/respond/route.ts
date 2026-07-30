import { NextRequest, NextResponse } from "next/server";
import { resolveDeviceChat } from "@/lib/employeeChatAuth";
import { respondToSessionRequest } from "@/lib/remoteSupport/sessionAuthorization";
import { SessionStateError } from "@/lib/remoteSupport/types";

// Called by the consent web page's Approve/Reject buttons (a real browser tab chattray
// launched - see chattray/main.go's openBrowser reuse). ChatToken proves "this is the
// legitimate companion for this specific device"; the nonce (echoed back from what the page
// was shown on load) is then independently re-validated against live DB state by
// respondToSessionRequest exactly as it would be for any other caller - ChatToken narrows who
// can even attempt this, the nonce still proves it's a response to the exact request that was
// actually pending, not just any request for this device.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : "";
  const token = typeof body?.token === "string" ? body.token : null;
  const sessionId = Number(body?.sessionId);
  const nonce = typeof body?.nonce === "string" ? body.nonce : "";
  const approved = body?.approved === true;

  const device = await resolveDeviceChat(deviceId, token);
  if (!device) {
    return NextResponse.json({ ok: false, error: "This link is no longer valid" });
  }
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid session id" });
  }

  try {
    const result = await respondToSessionRequest({ sessionId, deviceId, nonce, approved });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof SessionStateError) {
      return NextResponse.json({ ok: false, error: err.message });
    }
    throw err;
  }
}
