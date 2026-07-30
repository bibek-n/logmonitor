import { NextRequest, NextResponse } from "next/server";
import { resolveDeviceChat } from "@/lib/employeeChatAuth";
import { getLatestSessionForDevice, endSession } from "@/lib/remoteSupport/sessionAuthorization";
import { SessionStateError } from "@/lib/remoteSupport/types";

// Called either by the employee clicking "End Session" on the consent tab's active-session
// view, or by chattray itself if the native capture/peer connection hits an unrecoverable
// error and needs to report the session as over rather than leaving it stuck Active.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : "";
  const token = typeof body?.token === "string" ? body.token : null;
  const sessionId = Number(body?.sessionId);
  const reason = typeof body?.reason === "string" && body.reason ? body.reason : "EmployeeEnded";

  const device = await resolveDeviceChat(deviceId, token);
  if (!device) return NextResponse.json({ ok: false, error: "Unauthorized" });

  const session = await getLatestSessionForDevice(deviceId);
  if (!session || session.Id !== sessionId) {
    return NextResponse.json({ ok: false, error: "Session not found" });
  }

  try {
    await endSession({ sessionId, terminationReason: reason, requestedByDeviceId: deviceId });
  } catch (err) {
    if (err instanceof SessionStateError) {
      return NextResponse.json({ ok: false, error: err.message });
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
