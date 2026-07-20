import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { rtspUrlFor, type NvrDeviceRow } from "@/lib/nvr";
import { acquireLiveTranscode, releaseLiveTranscode } from "@/lib/transcodeRelay";
import { ensureLivePullPath } from "@/lib/mediamtx";

const MEDIAMTX_WHEP_BASE = "http://127.0.0.1:8889";

// Proxies the browser's WHEP (WebRTC-HTTP Egress Protocol) offer/answer exchange to MediaMTX,
// which is what actually pulls the camera's RTSP stream and republishes it as WebRTC (see
// C:\mediamtx\mediamtx.yml on the server - not part of this repo). This proxy exists so the
// browser only ever talks to this HTTPS origin for signaling; MediaMTX's own endpoint is
// plain HTTP on localhost, which browsers would block as mixed content if called directly
// from an HTTPS page. The actual media (RTP/DTLS-SRTP) still flows directly between the
// browser and MediaMTX once ICE negotiates - only the SDP offer/answer goes through here.
//
// Channels whose NVR stream is H.265/HEVC can't be served directly - no browser's WebRTC
// stack decodes HEVC - so those get routed through the on-demand transcode relay
// (transcodeRelay.ts) into a "{channel}_h264" MediaMTX path instead of the raw channel path.

interface CameraLookup {
  ChannelNumber: number | null;
  VideoCodec: string | null;
  NvrId: number;
}

async function lookupCamera(cameraId: number): Promise<CameraLookup | null> {
  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, cameraId)
    .query<CameraLookup>("SELECT ChannelNumber, VideoCodec, NvrId FROM NvrCameras WHERE Id = @id");
  return result.recordset[0] ?? null;
}

function transcodedPathName(channelNumber: number): string {
  return `channel${channelNumber}_h264`;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ cameraId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { cameraId: cameraIdParam } = await params;
  const cameraId = Number(cameraIdParam);
  if (!Number.isInteger(cameraId) || cameraId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid camera id" }, { status: 400 });
  }

  const camera = await lookupCamera(cameraId);
  console.log(`[webrtc] cameraId=${cameraId} lookup:`, JSON.stringify(camera));
  if (camera?.ChannelNumber == null) {
    return NextResponse.json({ ok: false, error: "This camera's channel number is unknown - try Re-sync." }, { status: 404 });
  }

  const db = await getDb();
  const nvrResult = await db.request().input("id", sql.Int, camera.NvrId).query<NvrDeviceRow>("SELECT * FROM NvrDevices WHERE Id = @id");
  const nvr = nvrResult.recordset[0];
  if (!nvr) return NextResponse.json({ ok: false, error: "NVR not found" }, { status: 404 });

  let mediamtxPath = `channel${camera.ChannelNumber}`;

  if (camera.VideoCodec === "hevc") {
    mediamtxPath = transcodedPathName(camera.ChannelNumber);
    console.log(`[webrtc] cameraId=${cameraId} is HEVC, acquiring transcode relay for path "${mediamtxPath}"...`);
    try {
      await acquireLiveTranscode(mediamtxPath, rtspUrlFor(nvr, camera.ChannelNumber));
      console.log(`[webrtc] cameraId=${cameraId} transcode relay ready for "${mediamtxPath}"`);
    } catch (err) {
      console.error(`[webrtc] cameraId=${cameraId} acquireLiveTranscode FAILED:`, err instanceof Error ? err.message : err);
      return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to start the transcoder for this camera." }, { status: 502 });
    }
  } else {
    // Most channels are pre-declared as static paths in mediamtx.yml, but a channel that only
    // exists because syncNvrCameras gap-filled it (ONVIF never listed it) never got a static
    // entry there - self-heal by registering it dynamically on first use instead of failing.
    try {
      await ensureLivePullPath(mediamtxPath, rtspUrlFor(nvr, camera.ChannelNumber));
    } catch (err) {
      console.error(`[webrtc] cameraId=${cameraId} ensureLivePullPath FAILED:`, err instanceof Error ? err.message : err);
      return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to register this camera's stream." }, { status: 502 });
    }
  }

  const offerSdp = await req.text();
  console.log(`[webrtc] cameraId=${cameraId} proxying WHEP offer to MediaMTX path "${mediamtxPath}" (offer length ${offerSdp.length})`);

  try {
    const mediamtxRes = await fetch(`${MEDIAMTX_WHEP_BASE}/${mediamtxPath}/whep`, {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: offerSdp,
      signal: AbortSignal.timeout(20000),
    });
    const answerSdp = await mediamtxRes.text();
    console.log(`[webrtc] cameraId=${cameraId} MediaMTX WHEP response: status=${mediamtxRes.status}`);
    if (!mediamtxRes.ok) {
      console.error(`[webrtc] cameraId=${cameraId} MediaMTX WHEP body:`, answerSdp.slice(0, 500));
      if (camera.VideoCodec === "hevc") releaseLiveTranscode(mediamtxPath);
      return NextResponse.json({ ok: false, error: `MediaMTX rejected the offer (HTTP ${mediamtxRes.status}): ${answerSdp.slice(0, 300)}` }, { status: 502 });
    }
    return new NextResponse(answerSdp, { headers: { "Content-Type": "application/sdp" } });
  } catch (err) {
    console.error(`[webrtc] cameraId=${cameraId} WHEP proxy threw:`, err instanceof Error ? err.message : err);
    if (camera.VideoCodec === "hevc") releaseLiveTranscode(mediamtxPath);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to reach the streaming server" }, { status: 502 });
  }
}

// Called when the viewer closes the live-view modal, so a transcode relay (real, continuous
// CPU cost) can be released promptly instead of only via its idle-timeout fallback. A no-op
// for non-HEVC channels, which were never routed through the relay to begin with.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ cameraId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { cameraId: cameraIdParam } = await params;
  const cameraId = Number(cameraIdParam);
  if (!Number.isInteger(cameraId) || cameraId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid camera id" }, { status: 400 });
  }

  const camera = await lookupCamera(cameraId);
  if (camera?.ChannelNumber != null && camera.VideoCodec === "hevc") {
    releaseLiveTranscode(transcodedPathName(camera.ChannelNumber));
  }

  return NextResponse.json({ ok: true });
}
