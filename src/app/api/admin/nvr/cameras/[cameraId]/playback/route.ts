import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { playbackRtspUrlFor, type NvrDeviceRow } from "@/lib/nvr";
import { playbackPathName, addPlaybackPath, removePlaybackPath } from "@/lib/mediamtx";

const MAX_PLAYBACK_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours - a sane upper bound on one session

async function loadCameraAndNvr(cameraId: number) {
  const db = await getDb();
  const camResult = await db
    .request()
    .input("id", sql.Int, cameraId)
    .query<{ NvrId: number; ChannelNumber: number | null }>("SELECT NvrId, ChannelNumber FROM NvrCameras WHERE Id = @id");
  const cam = camResult.recordset[0];
  if (!cam || cam.ChannelNumber == null) return null;

  const nvrResult = await db.request().input("id", sql.Int, cam.NvrId).query<NvrDeviceRow>("SELECT * FROM NvrDevices WHERE Id = @id");
  const nvr = nvrResult.recordset[0];
  if (!nvr) return null;

  return { nvr, channelNumber: cam.ChannelNumber };
}

// Registers an on-demand MediaMTX path sourced from the NVR's recorded-playback RTSP
// endpoint for a specific time range, so the browser can WHEP-connect to it exactly like
// the live view does. See playbackRtspUrlFor's comment - the exact time-window accuracy
// hasn't been visually verified against real footage yet.
export async function POST(req: NextRequest, { params }: { params: Promise<{ cameraId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { cameraId: cameraIdParam } = await params;
  const cameraId = Number(cameraIdParam);
  if (!Number.isInteger(cameraId) || cameraId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid camera id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const startTime = body?.startTime ? new Date(body.startTime) : null;
  const endTime = body?.endTime ? new Date(body.endTime) : null;
  if (!startTime || !endTime || Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || endTime <= startTime) {
    return NextResponse.json({ ok: false, error: "Invalid start/end time" }, { status: 400 });
  }
  if (endTime.getTime() - startTime.getTime() > MAX_PLAYBACK_WINDOW_MS) {
    return NextResponse.json({ ok: false, error: "Playback window is too long (max 6 hours per session)." }, { status: 400 });
  }

  const context = await loadCameraAndNvr(cameraId);
  if (!context) {
    return NextResponse.json({ ok: false, error: "This camera's channel number is unknown - try Re-sync." }, { status: 404 });
  }

  const rtspUrl = playbackRtspUrlFor(context.nvr, context.channelNumber, startTime, endTime);
  const sessionId = crypto.randomBytes(6).toString("hex");
  const pathName = playbackPathName(cameraId, sessionId);

  try {
    await addPlaybackPath(pathName, rtspUrl);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to start playback" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, pathName });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ cameraId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { cameraId: cameraIdParam } = await params;
  const cameraId = Number(cameraIdParam);
  const body = await req.json().catch(() => null);
  const pathName = typeof body?.pathName === "string" ? body.pathName : "";

  // Only ever tear down a path this same camera's playback session created - never an
  // arbitrary MediaMTX path name a caller might pass.
  if (!pathName.startsWith(`playback_${cameraId}_`)) {
    return NextResponse.json({ ok: false, error: "Invalid path name" }, { status: 400 });
  }

  await removePlaybackPath(pathName);
  return NextResponse.json({ ok: true });
}
