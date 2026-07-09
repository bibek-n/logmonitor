import { NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

export async function POST(_req: Request, { params }: { params: Promise<{ deviceId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { deviceId } = await params;
  const db = await getDb();

  const deviceResult = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .query<{ PrivacyMode: boolean }>("SELECT PrivacyMode FROM Devices WHERE DeviceId = @deviceId");
  const device = deviceResult.recordset[0];
  if (!device) {
    return NextResponse.json({ ok: false, error: "Device not found" }, { status: 404 });
  }
  if (device.PrivacyMode) {
    return NextResponse.json({ ok: false, error: "Privacy mode is enabled for this device" }, { status: 403 });
  }

  await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .input("requestedByUserId", sql.Int, admin.userId)
    .query("INSERT INTO PendingScreenshotRequests (DeviceId, RequestedByUserId) VALUES (@deviceId, @requestedByUserId)");

  return NextResponse.json({ ok: true });
}
