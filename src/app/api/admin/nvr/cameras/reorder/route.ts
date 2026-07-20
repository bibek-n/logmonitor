import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

// Body is the full list of camera IDs in the admin's chosen display order (from
// drag-and-drop in CamerasClient) - each one's SortOrder becomes its position in that array.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const order = Array.isArray(body?.order) ? body.order.filter((id: unknown) => Number.isInteger(id)) : null;
  if (!order || order.length === 0) {
    return NextResponse.json({ ok: false, error: "Missing or invalid order" }, { status: 400 });
  }

  const db = await getDb();
  await Promise.all(
    order.map((cameraId: number, index: number) =>
      db.request().input("id", sql.Int, cameraId).input("sortOrder", sql.Int, index).query("UPDATE NvrCameras SET SortOrder = @sortOrder WHERE Id = @id")
    )
  );

  return NextResponse.json({ ok: true });
}
