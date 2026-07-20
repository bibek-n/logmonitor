import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

// Sets an admin-friendly display name/location for a camera (e.g. "Front Door" / "Warehouse")
// - purely cosmetic, doesn't touch anything ONVIF/RTSP-related. Empty strings are stored as
// NULL so the UI can cleanly fall back to the raw ONVIF ChannelName.
export async function POST(req: NextRequest, { params }: { params: Promise<{ cameraId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { cameraId: cameraIdParam } = await params;
  const cameraId = Number(cameraIdParam);
  if (!Number.isInteger(cameraId) || cameraId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid camera id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.trim().slice(0, 150) : "";
  const location = typeof body?.location === "string" ? body.location.trim().slice(0, 150) : "";

  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, cameraId)
    .input("label", sql.NVarChar, label || null)
    .input("location", sql.NVarChar, location || null)
    .query("UPDATE NvrCameras SET Label = @label, Location = @location WHERE Id = @id");

  return NextResponse.json({ ok: true });
}
