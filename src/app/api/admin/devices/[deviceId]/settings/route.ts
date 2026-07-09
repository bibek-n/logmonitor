import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

const ALLOWED_INTERVALS = new Set([null, 1, 5, 15, 30]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { deviceId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    screenshotIntervalMinutes,
    privacyMode,
    staffId,
    department,
  }: { screenshotIntervalMinutes?: number | null; privacyMode?: boolean; staffId?: number | null; department?: string | null } = body;

  if (screenshotIntervalMinutes !== undefined && !ALLOWED_INTERVALS.has(screenshotIntervalMinutes)) {
    return NextResponse.json({ ok: false, error: "screenshotIntervalMinutes must be null, 1, 5, 15, or 30" }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .query<{ ScreenshotIntervalMinutes: number | null; PrivacyMode: boolean; StaffId: number | null; Department: string | null }>(
      "SELECT ScreenshotIntervalMinutes, PrivacyMode, StaffId, Department FROM Devices WHERE DeviceId = @deviceId"
    );
  const current = existing.recordset[0];
  if (!current) {
    return NextResponse.json({ ok: false, error: "Device not found" }, { status: 404 });
  }

  await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .input("interval", sql.Int, screenshotIntervalMinutes !== undefined ? screenshotIntervalMinutes : current.ScreenshotIntervalMinutes)
    .input("privacyMode", sql.Bit, privacyMode !== undefined ? privacyMode : current.PrivacyMode)
    .input("staffId", sql.Int, staffId !== undefined ? staffId : current.StaffId)
    .input("department", sql.NVarChar, department !== undefined ? department : current.Department)
    .query(`
      UPDATE Devices
      SET ScreenshotIntervalMinutes = @interval, PrivacyMode = @privacyMode, StaffId = @staffId, Department = @department
      WHERE DeviceId = @deviceId
    `);

  return NextResponse.json({ ok: true });
}
