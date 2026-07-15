import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { VALID_SCHEDULE_TYPES } from "@/lib/websitePerformance/shared";

const MAX_BULK = 100;

// Bulk enable/disable/reschedule - a lighter-weight sibling of the per-website config PUT,
// only ever touching Enabled/ScheduleType (the two fields that make sense to change in bulk).
// Threshold/device/timeout tuning stays per-website via /config.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const websiteIds: number[] = Array.isArray(body?.websiteIds)
    ? body.websiteIds.map((v: unknown) => Number(v)).filter((v: number) => Number.isInteger(v))
    : [];
  if (websiteIds.length === 0) return NextResponse.json({ ok: false, error: "At least one websiteId is required." }, { status: 400 });
  if (websiteIds.length > MAX_BULK) return NextResponse.json({ ok: false, error: `A bulk update is limited to ${MAX_BULK} websites at once.` }, { status: 400 });

  const enabled = body?.enabled !== undefined ? Boolean(body.enabled) : null;
  const scheduleType = typeof body?.scheduleType === "string" ? body.scheduleType : null;
  if (scheduleType && !VALID_SCHEDULE_TYPES.has(scheduleType)) {
    return NextResponse.json({ ok: false, error: "Invalid scheduleType." }, { status: 400 });
  }
  if (enabled === null && scheduleType === null) {
    return NextResponse.json({ ok: false, error: "Provide at least one of enabled or scheduleType." }, { status: 400 });
  }

  const db = await getDb();
  let updated = 0;
  for (const websiteId of websiteIds) {
    await db
      .request()
      .input("websiteId", sql.Int, websiteId)
      .input("enabled", sql.Bit, enabled ?? false)
      .input("scheduleType", sql.VarChar, scheduleType ?? "Daily")
      .query(`
        MERGE WebsitePerformanceConfigs AS target
        USING (SELECT @websiteId AS WebsiteId) AS source
        ON target.WebsiteId = source.WebsiteId
        WHEN MATCHED THEN UPDATE SET
          Enabled = ${enabled === null ? "target.Enabled" : "@enabled"},
          ScheduleType = ${scheduleType === null ? "target.ScheduleType" : "@scheduleType"},
          UpdatedAt = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT (WebsiteId, Enabled, ScheduleType) VALUES (@websiteId, @enabled, @scheduleType);
      `);
    updated += 1;
  }

  await logAdminAction({ admin, section: "website-performance", action: "bulk_config", details: `count=${updated}`, req });
  return NextResponse.json({ ok: true, data: { updated } });
}
