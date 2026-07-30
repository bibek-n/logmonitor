import { NextRequest, NextResponse } from "next/server";
import { resolveDeviceChat } from "@/lib/employeeChatAuth";
import { getLatestSessionForDevice } from "@/lib/remoteSupport/sessionAuthorization";
import { enqueueSignalMessage, pollSignalMessages } from "@/lib/remoteSupport/signalingRelay";
import type { SignalMessageType } from "@/lib/remoteSupport/types";

const VALID_MESSAGE_TYPES: SignalMessageType[] = ["offer", "answer", "ice-candidate"];

// Used only by chattray's native pion PeerConnection (the browser consent tab never touches
// signaling directly) - chattray writes ToAdmin, reads ToAgent. Mirrors the admin-side signal
// route's shape exactly, just swapping the auth model.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : "";
  const token = typeof body?.token === "string" ? body.token : null;
  const sessionId = Number(body?.sessionId);

  const device = await resolveDeviceChat(deviceId, token);
  if (!device) return NextResponse.json({ ok: false, error: "Unauthorized" });
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid session id" });
  }

  const session = await getLatestSessionForDevice(deviceId);
  if (!session || session.Id !== sessionId) {
    return NextResponse.json({ ok: false, error: "Session not found" });
  }
  if (!["Approved", "Active"].includes(session.Status)) {
    return NextResponse.json({ ok: false, error: "Session is not open for signaling" });
  }

  const messageType = body?.type;
  const payload = body?.payload;
  if (!VALID_MESSAGE_TYPES.includes(messageType) || typeof payload !== "string" || !payload) {
    return NextResponse.json({ ok: false, error: "Invalid signal message" });
  }

  await enqueueSignalMessage(sessionId, "ToAdmin", messageType, payload);
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get("deviceId") ?? "";
  const token = req.nextUrl.searchParams.get("token");
  const sessionId = Number(req.nextUrl.searchParams.get("sessionId"));

  const device = await resolveDeviceChat(deviceId, token);
  if (!device) return NextResponse.json({ ok: false, error: "Unauthorized", messages: [] });
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid session id", messages: [] });
  }

  const session = await getLatestSessionForDevice(deviceId);
  if (!session || session.Id !== sessionId) {
    return NextResponse.json({ ok: false, error: "Session not found", messages: [] });
  }
  if (session.Status === "Ended" || session.Status === "Rejected" || session.Status === "Expired") {
    return NextResponse.json({ ok: false, error: "Session has ended", messages: [] });
  }

  const messages = await pollSignalMessages(sessionId, "ToAgent");
  return NextResponse.json({ ok: true, messages });
}
