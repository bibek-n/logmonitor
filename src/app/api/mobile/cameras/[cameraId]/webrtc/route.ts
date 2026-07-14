import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireMobileAdmin, isMobileSession } from "@/lib/mobileAuth";

const MEDIAMTX_WHEP_BASE = "http://127.0.0.1:8889";

// Mobile equivalent of /api/admin/nvr/cameras/[cameraId]/webrtc/route.ts - same WHEP proxy
// to MediaMTX, but always 200 (see every other mobile/* route for why) instead of using
// 400/404/502, since the app can't tell a real IIS-swallowed-body 502 apart from any other
// HTML response otherwise. On success the body is raw SDP (Content-Type: application/sdp);
// on failure it's the usual {ok:false, error} JSON - the app distinguishes by Content-Type.
export async function POST(req: NextRequest, { params }: { params: Promise<{ cameraId: string }> }) {
  const admin = await requireMobileAdmin(req);
  if (!isMobileSession(admin)) return admin;

  const { cameraId: cameraIdParam } = await params;
  const cameraId = Number(cameraIdParam);
  if (!Number.isInteger(cameraId) || cameraId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid camera id" });
  }

  try {
    const db = await getDb();
    const result = await db
      .request()
      .input("id", sql.Int, cameraId)
      .query<{ ChannelNumber: number | null }>("SELECT ChannelNumber FROM NvrCameras WHERE Id = @id");
    const channelNumber = result.recordset[0]?.ChannelNumber;
    if (channelNumber == null) {
      return NextResponse.json({ ok: false, error: "This camera's channel number is unknown - try Re-sync." });
    }

    const offerSdp = await req.text();
    const mediamtxRes = await fetch(`${MEDIAMTX_WHEP_BASE}/channel${channelNumber}/whep`, {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: offerSdp,
      signal: AbortSignal.timeout(20000),
    });
    const answerSdp = await mediamtxRes.text();
    if (!mediamtxRes.ok) {
      return NextResponse.json({ ok: false, error: `Stream rejected the offer (HTTP ${mediamtxRes.status}): ${answerSdp.slice(0, 300)}` });
    }
    return new NextResponse(answerSdp, { headers: { "Content-Type": "application/sdp" } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to reach the streaming server" });
  }
}
