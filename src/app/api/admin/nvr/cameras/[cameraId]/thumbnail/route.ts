import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { rtspUrlFor } from "@/lib/nvr";
import { getThumbnail } from "@/lib/thumbnail";

interface CameraRow {
  ChannelNumber: number | null;
  IpAddress: string;
  RtspPort: number;
  Username: string;
  Password: string;
  RtspUsername: string | null;
  RtspPassword: string | null;
}

// Returns a cached still frame for the camera grid (see thumbnail.ts). On any failure the
// client falls back to a static placeholder image rather than this route trying to serve one
// itself - keeps this route's only job "return a real JPEG or fail", nothing in between.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ cameraId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { cameraId: cameraIdParam } = await params;
  const cameraId = Number(cameraIdParam);
  if (!Number.isInteger(cameraId) || cameraId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid camera id" }, { status: 400 });
  }

  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, cameraId)
    .query<CameraRow>(`
      SELECT c.ChannelNumber, n.IpAddress, n.RtspPort, n.Username, n.Password, n.RtspUsername, n.RtspPassword
      FROM NvrCameras c JOIN NvrDevices n ON n.Id = c.NvrId
      WHERE c.Id = @id
    `);
  const row = result.recordset[0];
  if (!row || row.ChannelNumber === null) {
    return NextResponse.json({ ok: false, error: "This camera's channel number is unknown - try Re-sync." }, { status: 404 });
  }

  const rtspUrl = rtspUrlFor(row, row.ChannelNumber, 1);

  try {
    const image = await getThumbnail(cameraId, rtspUrl);
    return new NextResponse(new Uint8Array(image), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=25" },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Thumbnail grab failed" }, { status: 502 });
  }
}
