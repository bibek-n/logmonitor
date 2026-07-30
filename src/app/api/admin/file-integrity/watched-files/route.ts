import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query(`
    SELECT w.Id, w.DeviceId, d.DeviceName, d.Hostname, w.FilePath, w.Enabled, CONVERT(VARCHAR(19), w.CreatedAt, 126) AS CreatedAt
    FROM WatchedFiles w
    JOIN Devices d ON d.DeviceId = w.DeviceId
    ORDER BY d.DeviceName ASC, w.FilePath ASC
  `);
  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId.trim() : "";
  const filePath = typeof body?.filePath === "string" ? body.filePath.trim() : "";

  if (!deviceId || !filePath) {
    return NextResponse.json({ ok: false, error: "deviceId and filePath are required." }, { status: 400 });
  }

  const db = await getDb();
  const deviceResult = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .query<{ DeviceName: string | null; Hostname: string }>("SELECT DeviceName, Hostname FROM Devices WHERE DeviceId = @deviceId");
  const device = deviceResult.recordset[0];
  if (!device) {
    return NextResponse.json({ ok: false, error: "Device not found." }, { status: 404 });
  }

  const existing = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .input("filePath", sql.NVarChar, filePath)
    .query("SELECT Id FROM WatchedFiles WHERE DeviceId = @deviceId AND FilePath = @filePath");
  if (existing.recordset.length > 0) {
    return NextResponse.json({ ok: false, error: "This file is already being watched on this device." }, { status: 400 });
  }

  await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .input("filePath", sql.NVarChar, filePath)
    .input("userId", sql.Int, admin.userId)
    .query("INSERT INTO WatchedFiles (DeviceId, FilePath, CreatedByUserId) VALUES (@deviceId, @filePath, @userId)");

  await logAdminAction({
    admin,
    section: "file-integrity",
    action: "watched_file_add",
    details: `${filePath} on ${device.DeviceName ?? device.Hostname}`,
    req,
  });

  return NextResponse.json({
    ok: true,
    note: "The device will start monitoring this file on its next check-in (within a few minutes) and record its current content as the baseline.",
  });
}
