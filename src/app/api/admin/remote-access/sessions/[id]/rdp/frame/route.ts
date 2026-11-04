import { NextRequest, NextResponse } from "next/server";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { getRdpFrame } from "@/lib/remoteAccess/rdpSessionService";

// Polled by RdpViewerClient every ~250ms - same pattern as sessions/[id]/vnc/frame/route.ts.
// Also echoes back the session's current width/height since RDP's "resize-method: display-update"
// lets the remote desktop's actual resolution change after connect (the VNC viewer doesn't need
// this because RFB's resolution is fixed for the life of the connection).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_rdp_start");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const since = Number(req.nextUrl.searchParams.get("since") ?? "0");
  const result = getRdpFrame(Number(id), Number.isFinite(since) ? since : 0);
  if (!result) return NextResponse.json({ ok: false, error: "Session not found or already ended" }, { status: 404 });

  return NextResponse.json({ ok: true, data: result });
}
