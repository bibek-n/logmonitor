import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { syncNvrCameras } from "@/lib/nvr";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid NVR id" });
  }

  const result = await syncNvrCameras(id);
  return NextResponse.json({ ok: result.ok, error: result.error, cameraCount: result.cameraCount });
}
