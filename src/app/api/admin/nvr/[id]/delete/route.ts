import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid NVR id" });
  }

  const db = await getDb();
  // Cascades to NvrCameras via FK_NvrCameras_NvrDevices ON DELETE CASCADE.
  await db.request().input("id", sql.Int, id).query("DELETE FROM NvrDevices WHERE Id = @id");

  return NextResponse.json({ ok: true });
}
