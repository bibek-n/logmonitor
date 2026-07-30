import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

const ALLOWED_INTERVALS = new Set([null, 1, 5, 15, 30]);
const ALLOWED_BROWSER_ACTIVITY_INTERVALS = new Set([null, 5, 15, 30, 60]);

// The install-time consent notice text version this route enforces re-confirmation against
// (see agent/consent_windows.go / agent/install.sh) - bump this if that text changes again,
// so devices consented under an older version require a fresh admin re-notification checkbox
// before browser activity collection can be turned on for them.
const BROWSER_ACTIVITY_NOTICE_VERSION = "v1";

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
    browserActivityIntervalMinutes,
    browserActivityReconsentConfirmed,
  }: {
    screenshotIntervalMinutes?: number | null;
    privacyMode?: boolean;
    staffId?: number | null;
    department?: string | null;
    browserActivityIntervalMinutes?: number | null;
    browserActivityReconsentConfirmed?: boolean;
  } = body;

  if (screenshotIntervalMinutes !== undefined && !ALLOWED_INTERVALS.has(screenshotIntervalMinutes)) {
    return NextResponse.json({ ok: false, error: "screenshotIntervalMinutes must be null, 1, 5, 15, or 30" }, { status: 400 });
  }
  if (browserActivityIntervalMinutes !== undefined && !ALLOWED_BROWSER_ACTIVITY_INTERVALS.has(browserActivityIntervalMinutes)) {
    return NextResponse.json({ ok: false, error: "browserActivityIntervalMinutes must be null, 5, 15, 30, or 60" }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .query<{
      ScreenshotIntervalMinutes: number | null;
      PrivacyMode: boolean;
      StaffId: number | null;
      Department: string | null;
      BrowserActivityIntervalMinutes: number | null;
    }>(
      "SELECT ScreenshotIntervalMinutes, PrivacyMode, StaffId, Department, BrowserActivityIntervalMinutes FROM Devices WHERE DeviceId = @deviceId"
    );
  const current = existing.recordset[0];
  if (!current) {
    return NextResponse.json({ ok: false, error: "Device not found" }, { status: 404 });
  }

  // Turning browser activity collection ON for this device requires the admin to confirm the
  // employee has been (re-)notified per the current notice text - see the approved plan's
  // re-consent requirement for devices enrolled before this collection category existed.
  // Turning it off, or leaving it unchanged, never requires this.
  const enablingBrowserActivity =
    browserActivityIntervalMinutes !== undefined &&
    browserActivityIntervalMinutes !== null &&
    browserActivityIntervalMinutes !== current.BrowserActivityIntervalMinutes;
  if (enablingBrowserActivity && !browserActivityReconsentConfirmed) {
    return NextResponse.json(
      { ok: false, error: "Confirm the employee has been notified of browser activity monitoring before enabling it (browserActivityReconsentConfirmed)." },
      { status: 400 }
    );
  }

  await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .input("interval", sql.Int, screenshotIntervalMinutes !== undefined ? screenshotIntervalMinutes : current.ScreenshotIntervalMinutes)
    .input("privacyMode", sql.Bit, privacyMode !== undefined ? privacyMode : current.PrivacyMode)
    .input("staffId", sql.Int, staffId !== undefined ? staffId : current.StaffId)
    .input("department", sql.NVarChar, department !== undefined ? department : current.Department)
    .input(
      "browserActivityInterval",
      sql.Int,
      browserActivityIntervalMinutes !== undefined ? browserActivityIntervalMinutes : current.BrowserActivityIntervalMinutes
    )
    .query(`
      UPDATE Devices
      SET ScreenshotIntervalMinutes = @interval, PrivacyMode = @privacyMode, StaffId = @staffId, Department = @department,
        BrowserActivityIntervalMinutes = @browserActivityInterval
      WHERE DeviceId = @deviceId
    `);

  if (enablingBrowserActivity) {
    const staffResult = await db.request().input("deviceId", sql.VarChar, deviceId).query<{ StaffId: number | null }>(
      "SELECT StaffId FROM Devices WHERE DeviceId = @deviceId"
    );
    await db
      .request()
      .input("deviceId", sql.VarChar, deviceId)
      .input("staffId", sql.Int, staffResult.recordset[0]?.StaffId ?? null)
      .input("noticeVersion", sql.VarChar, BROWSER_ACTIVITY_NOTICE_VERSION)
      .query(`INSERT INTO BrowserActivityConsentAck (DeviceId, StaffId, NoticeVersion) VALUES (@deviceId, @staffId, @noticeVersion)`);
  }

  return NextResponse.json({ ok: true });
}
