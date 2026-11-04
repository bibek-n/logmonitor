import { NextRequest, NextResponse } from "next/server";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { getVncFrame } from "@/lib/remoteAccess/vncSessionService";

// Polled by VncViewerClient every ~250ms - same HTTP-polling design as the Terminal's
// output route, just returning a JPEG frame (base64 data URL, keeping this app's all-JSON API
// convention) instead of text. `since` lets the client skip re-drawing an unchanged frame.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_vnc_start");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const since = Number(req.nextUrl.searchParams.get("since") ?? "0");
  const result = getVncFrame(Number(id), Number.isFinite(since) ? since : 0);
  if (!result) return NextResponse.json({ ok: false, error: "Session not found or already ended" }, { status: 404 });

  return NextResponse.json({ ok: true, data: result });
}
