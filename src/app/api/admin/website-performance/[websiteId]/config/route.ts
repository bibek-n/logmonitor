import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { VALID_TEST_DEVICES, VALID_SCHEDULE_TYPES, type WebsitePerformanceConfigRow } from "@/lib/websitePerformance/shared";

const DEFAULT_CONFIG: Omit<WebsitePerformanceConfigRow, "Id" | "WebsiteId" | "CreatedAt" | "UpdatedAt"> = {
  Enabled: false,
  TestDevice: "Both",
  ScheduleType: "Daily",
  CustomCron: null,
  TimeoutSeconds: 60,
  ScreenshotCapture: true,
  ScoreThreshold: null,
  LcpThresholdMs: null,
  ClsThreshold: null,
  TbtThresholdMs: null,
  PageSizeThresholdKb: null,
  RequestCountThreshold: null,
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ websiteId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const websiteId = Number((await params).websiteId);
  if (!Number.isInteger(websiteId)) return NextResponse.json({ ok: false, error: "Invalid websiteId." }, { status: 400 });

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, websiteId).query<WebsitePerformanceConfigRow>(
    "SELECT * FROM WebsitePerformanceConfigs WHERE WebsiteId = @id"
  );

  const config = result.recordset[0] ?? { Id: 0, WebsiteId: websiteId, CreatedAt: "", UpdatedAt: "", ...DEFAULT_CONFIG };
  return NextResponse.json({ ok: true, data: config });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ websiteId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const websiteId = Number((await params).websiteId);
  if (!Number.isInteger(websiteId)) return NextResponse.json({ ok: false, error: "Invalid websiteId." }, { status: 400 });

  const db = await getDb();
  const websiteCheck = await db.request().input("id", sql.Int, websiteId).query<{ Id: number }>("SELECT Id FROM Websites WHERE Id = @id");
  if (!websiteCheck.recordset[0]) return NextResponse.json({ ok: false, error: "Website not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const enabled = Boolean(body?.enabled);
  const testDevice = typeof body?.testDevice === "string" ? body.testDevice : DEFAULT_CONFIG.TestDevice;
  const scheduleType = typeof body?.scheduleType === "string" ? body.scheduleType : DEFAULT_CONFIG.ScheduleType;
  const customCron = typeof body?.customCron === "string" ? body.customCron.trim() || null : null;
  const timeoutSeconds = Number.isInteger(body?.timeoutSeconds) ? body.timeoutSeconds : DEFAULT_CONFIG.TimeoutSeconds;
  const screenshotCapture = body?.screenshotCapture === undefined ? true : Boolean(body.screenshotCapture);
  const scoreThreshold = body?.scoreThreshold != null ? Number(body.scoreThreshold) : null;
  const lcpThresholdMs = body?.lcpThresholdMs != null ? Number(body.lcpThresholdMs) : null;
  const clsThreshold = body?.clsThreshold != null ? Number(body.clsThreshold) : null;
  const tbtThresholdMs = body?.tbtThresholdMs != null ? Number(body.tbtThresholdMs) : null;
  const pageSizeThresholdKb = body?.pageSizeThresholdKb != null ? Number(body.pageSizeThresholdKb) : null;
  const requestCountThreshold = body?.requestCountThreshold != null ? Number(body.requestCountThreshold) : null;

  if (!VALID_TEST_DEVICES.has(testDevice)) return NextResponse.json({ ok: false, error: "Invalid testDevice." }, { status: 400 });
  if (!VALID_SCHEDULE_TYPES.has(scheduleType)) return NextResponse.json({ ok: false, error: "Invalid scheduleType." }, { status: 400 });
  if (scheduleType === "Custom" && !customCron) return NextResponse.json({ ok: false, error: "customCron is required when scheduleType is Custom." }, { status: 400 });
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 10 || timeoutSeconds > 180) {
    return NextResponse.json({ ok: false, error: "timeoutSeconds must be between 10 and 180." }, { status: 400 });
  }

  await db
    .request()
    .input("websiteId", sql.Int, websiteId)
    .input("enabled", sql.Bit, enabled)
    .input("testDevice", sql.VarChar, testDevice)
    .input("scheduleType", sql.VarChar, scheduleType)
    .input("customCron", sql.NVarChar, customCron)
    .input("timeoutSeconds", sql.Int, timeoutSeconds)
    .input("screenshotCapture", sql.Bit, screenshotCapture)
    .input("scoreThreshold", sql.Int, scoreThreshold)
    .input("lcpThresholdMs", sql.Int, lcpThresholdMs)
    .input("clsThreshold", sql.Float, clsThreshold)
    .input("tbtThresholdMs", sql.Int, tbtThresholdMs)
    .input("pageSizeThresholdKb", sql.Int, pageSizeThresholdKb)
    .input("requestCountThreshold", sql.Int, requestCountThreshold)
    .query(`
      MERGE WebsitePerformanceConfigs AS target
      USING (SELECT @websiteId AS WebsiteId) AS source
      ON target.WebsiteId = source.WebsiteId
      WHEN MATCHED THEN UPDATE SET
        Enabled = @enabled, TestDevice = @testDevice, ScheduleType = @scheduleType, CustomCron = @customCron,
        TimeoutSeconds = @timeoutSeconds, ScreenshotCapture = @screenshotCapture, ScoreThreshold = @scoreThreshold,
        LcpThresholdMs = @lcpThresholdMs, ClsThreshold = @clsThreshold, TbtThresholdMs = @tbtThresholdMs,
        PageSizeThresholdKb = @pageSizeThresholdKb, RequestCountThreshold = @requestCountThreshold, UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (
        WebsiteId, Enabled, TestDevice, ScheduleType, CustomCron, TimeoutSeconds, ScreenshotCapture,
        ScoreThreshold, LcpThresholdMs, ClsThreshold, TbtThresholdMs, PageSizeThresholdKb, RequestCountThreshold
      ) VALUES (
        @websiteId, @enabled, @testDevice, @scheduleType, @customCron, @timeoutSeconds, @screenshotCapture,
        @scoreThreshold, @lcpThresholdMs, @clsThreshold, @tbtThresholdMs, @pageSizeThresholdKb, @requestCountThreshold
      );
    `);

  const result = await db.request().input("id", sql.Int, websiteId).query<WebsitePerformanceConfigRow>(
    "SELECT * FROM WebsitePerformanceConfigs WHERE WebsiteId = @id"
  );
  return NextResponse.json({ ok: true, data: result.recordset[0] });
}
