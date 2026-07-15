import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { proxyWhepOffer } from "@/lib/mediamtx";

// Same WHEP signaling proxy pattern as the live-view route, but targets a caller-supplied
// dynamic playback path instead of a fixed channel{N} path - see
// /api/admin/nvr/cameras/[cameraId]/playback/route.ts, which creates that path.
export async function POST(req: NextRequest, { params }: { params: Promise<{ cameraId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { cameraId: cameraIdParam } = await params;
  const cameraId = Number(cameraIdParam);
  const pathName = req.nextUrl.searchParams.get("path") ?? "";

  // Same guard as the DELETE route - only ever proxy to a playback path that was created
  // for this exact camera, never an arbitrary MediaMTX path name.
  if (!pathName.startsWith(`playback_${cameraId}_`)) {
    return NextResponse.json({ ok: false, error: "Invalid or missing playback path" }, { status: 400 });
  }

  const offerSdp = await req.text();
  const result = await proxyWhepOffer(pathName, offerSdp);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: `MediaMTX rejected the offer (HTTP ${result.status}): ${result.error}` }, { status: 502 });
  }

  return new NextResponse(result.answerSdp, { headers: { "Content-Type": "application/sdp" } });
}
