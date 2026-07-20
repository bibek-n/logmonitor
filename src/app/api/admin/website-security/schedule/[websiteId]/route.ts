import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

const VALID_TYPES = ["Daily", "Weekly", "Monthly", "Yearly", "Disabled"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

interface ScheduleRow {
  ScheduleType: string;
  TimesPerDay: number;
  ScanTimes: string;
  RepeatIntervalDays: number | null;
  DayOfWeek: number | null;
  DayOfMonth: number | null;
  MonthOfYear: number | null;
  LastRunAt: string | null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ websiteId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { websiteId: websiteIdParam } = await params;
  const websiteId = Number(websiteIdParam);
  if (!Number.isInteger(websiteId) || websiteId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid website id" });
  }

  const db = await getDb();
  const result = await db
    .request()
    .input("websiteId", sql.Int, websiteId)
    .query<ScheduleRow>(
      "SELECT ScheduleType, TimesPerDay, ScanTimes, RepeatIntervalDays, DayOfWeek, DayOfMonth, MonthOfYear, LastRunAt FROM WebsiteScanSchedules WHERE WebsiteId = @websiteId"
    );

  return NextResponse.json({ ok: true, schedule: result.recordset[0] ?? null });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ websiteId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { websiteId: websiteIdParam } = await params;
  const websiteId = Number(websiteIdParam);
  if (!Number.isInteger(websiteId) || websiteId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid website id" });
  }

  const body = await req.json().catch(() => null);
  const scheduleType = typeof body?.scheduleType === "string" ? body.scheduleType : "";
  if (!VALID_TYPES.includes(scheduleType)) {
    return NextResponse.json({ ok: false, error: `scheduleType must be one of ${VALID_TYPES.join(", ")}` });
  }

  const timesPerDay = Number.isInteger(body?.timesPerDay) ? body.timesPerDay : 1;
  if (timesPerDay < 1 || timesPerDay > 4) {
    return NextResponse.json({ ok: false, error: "timesPerDay must be between 1 and 4" });
  }

  const scanTimesArr: unknown[] = Array.isArray(body?.scanTimes) ? body.scanTimes : [];
  if (scanTimesArr.length !== timesPerDay || !scanTimesArr.every((t) => typeof t === "string" && TIME_RE.test(t))) {
    return NextResponse.json({ ok: false, error: `Provide exactly ${timesPerDay} valid time(s) in HH:MM format` });
  }
  const scanTimes = (scanTimesArr as string[]).join(",");

  const repeatIntervalDays = body?.repeatIntervalDays == null ? null : Number(body.repeatIntervalDays);
  if (repeatIntervalDays != null && (!Number.isInteger(repeatIntervalDays) || repeatIntervalDays < 1)) {
    return NextResponse.json({ ok: false, error: "repeatIntervalDays must be a positive whole number of days" });
  }

  let dayOfWeek: number | null = null;
  let dayOfMonth: number | null = null;
  let monthOfYear: number | null = null;

  if (scheduleType === "Weekly") {
    dayOfWeek = Number.isInteger(body?.dayOfWeek) ? body.dayOfWeek : null;
    if (dayOfWeek === null || dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json({ ok: false, error: "dayOfWeek (0=Sunday..6=Saturday) is required for a Weekly schedule" });
    }
  } else if (scheduleType === "Monthly") {
    dayOfMonth = Number.isInteger(body?.dayOfMonth) ? body.dayOfMonth : null;
    if (dayOfMonth === null || dayOfMonth < 1 || dayOfMonth > 31) {
      return NextResponse.json({ ok: false, error: "dayOfMonth (1-31) is required for a Monthly schedule" });
    }
  } else if (scheduleType === "Yearly") {
    dayOfMonth = Number.isInteger(body?.dayOfMonth) ? body.dayOfMonth : null;
    monthOfYear = Number.isInteger(body?.monthOfYear) ? body.monthOfYear : null;
    if (dayOfMonth === null || dayOfMonth < 1 || dayOfMonth > 31 || monthOfYear === null || monthOfYear < 1 || monthOfYear > 12) {
      return NextResponse.json({ ok: false, error: "dayOfMonth (1-31) and monthOfYear (1-12) are required for a Yearly schedule" });
    }
  }

  const db = await getDb();
  const websiteResult = await db.request().input("id", sql.Int, websiteId).query<{ Id: number }>("SELECT Id FROM Websites WHERE Id = @id");
  if (!websiteResult.recordset[0]) return NextResponse.json({ ok: false, error: "Website not found" });

  await db
    .request()
    .input("websiteId", sql.Int, websiteId)
    .input("scheduleType", sql.NVarChar, scheduleType)
    .input("timesPerDay", sql.Int, timesPerDay)
    .input("scanTimes", sql.NVarChar, scanTimes)
    .input("repeatIntervalDays", sql.Int, repeatIntervalDays)
    .input("dayOfWeek", sql.Int, dayOfWeek)
    .input("dayOfMonth", sql.Int, dayOfMonth)
    .input("monthOfYear", sql.Int, monthOfYear)
    .query(`
      MERGE WebsiteScanSchedules AS target
      USING (SELECT @websiteId AS WebsiteId) AS src
      ON target.WebsiteId = src.WebsiteId
      WHEN MATCHED THEN UPDATE SET
        ScheduleType = @scheduleType, TimesPerDay = @timesPerDay, ScanTimes = @scanTimes,
        RepeatIntervalDays = @repeatIntervalDays, DayOfWeek = @dayOfWeek, DayOfMonth = @dayOfMonth,
        MonthOfYear = @monthOfYear, UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (WebsiteId, ScheduleType, TimesPerDay, ScanTimes, RepeatIntervalDays, DayOfWeek, DayOfMonth, MonthOfYear)
        VALUES (@websiteId, @scheduleType, @timesPerDay, @scanTimes, @repeatIntervalDays, @dayOfWeek, @dayOfMonth, @monthOfYear);
    `);

  return NextResponse.json({ ok: true });
}
