import "dotenv/config";
import { getDb, sql } from "../src/lib/db";
import { runScan } from "../src/lib/websiteSecurityAudit/runScan";
import { sendScanReportEmail } from "../src/lib/websiteSecurityAudit/emailReport";
import { deleteAuditPdf } from "../src/lib/websiteSecurityAudit/generatePdf";
import { isScheduleDue, parseScanTimes, type ScanSchedule } from "../src/lib/websiteSecurityAudit/scanScheduler";

const RETENTION_DAYS = 7;
const DEFAULT_SCAN_TIME = "02:00";

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

async function purgeOldData(): Promise<void> {
  const db = await getDb();
  const reportsResult = await db.query<{ PdfPath: string }>(`
    SELECT r.PdfPath FROM WebsiteAuditReports r
    JOIN WebsiteAuditScans s ON s.Id = r.ScanId
    WHERE s.ScanDate < DATEADD(day, -${RETENTION_DAYS}, CAST(SYSUTCDATETIME() AS DATE))
  `);
  for (const r of reportsResult.recordset) {
    await deleteAuditPdf(r.PdfPath);
  }

  // Cascades to Findings/DependencyFindings/CodeFindings/Reports/EmailLogs for those scans.
  // WebsiteAuditActivityLogs is deliberately untouched — it has no FK to Scans so it survives
  // as the "minimal activity log" the retention requirement asks to keep.
  const result = await db.query(
    `DELETE FROM WebsiteAuditScans WHERE ScanDate < DATEADD(day, -${RETENTION_DAYS}, CAST(SYSUTCDATETIME() AS DATE))`
  );
  const deleted = (result as unknown as { rowsAffected?: number[] }).rowsAffected?.[0] ?? 0;
  if (deleted > 0 || reportsResult.recordset.length > 0) {
    console.log(`[scan-checker] purged ${deleted} scan(s) and ${reportsResult.recordset.length} report file(s) older than ${RETENTION_DAYS} days.`);
  }
}

async function runScanForWebsite(website: { Id: number; Name: string; Url: string }, triggeredBy: string): Promise<void> {
  const db = await getDb();
  console.log(`[scan-checker] ${website.Name}: scanning...`);
  try {
    const summary = await runScan({ websiteId: website.Id, url: website.Url, triggeredByUserId: null, triggeredBy });
    await sendScanReportEmail(summary.scanId, "Scheduled Website Security Audit Report");

    await db
      .request()
      .input("websiteId", sql.Int, website.Id)
      .input("scanId", sql.Int, summary.scanId)
      .query(
        "INSERT INTO WebsiteAuditActivityLogs (WebsiteId, ScanId, Action, ActorName) VALUES (@websiteId, @scanId, 'scheduled_scan_completed', 'scheduled-scan')"
      );
    console.log(`[scan-checker] ${website.Name}: done — score ${summary.securityScore}, risk ${summary.riskLevel}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[scan-checker] ${website.Name}: FAILED —`, message);
    await db
      .request()
      .input("websiteId", sql.Int, website.Id)
      .input("details", sql.NVarChar, message)
      .query("INSERT INTO WebsiteAuditActivityLogs (WebsiteId, Action, Details, ActorName) VALUES (@websiteId, 'scheduled_scan_failed', @details, 'scheduled-scan')");
  }
}

function timeMatchesNow(now: Date, hhmm: string, toleranceMinutes: number): boolean {
  const [h, m] = hhmm.split(":").map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  return Math.abs(now.getTime() - target.getTime()) / 60000 <= toleranceMinutes;
}

async function main() {
  const db = await getDb();
  const now = new Date();

  const websitesResult = await db.query<{ Id: number; Name: string; Url: string }>(
    "SELECT Id, Name, Url FROM Websites WHERE Enabled = 1 ORDER BY Name"
  );

  for (const website of websitesResult.recordset) {
    const scheduleResult = await db
      .request()
      .input("websiteId", sql.Int, website.Id)
      .query<ScheduleRow>("SELECT ScheduleType, TimesPerDay, ScanTimes, RepeatIntervalDays, DayOfWeek, DayOfMonth, MonthOfYear, LastRunAt FROM WebsiteScanSchedules WHERE WebsiteId = @websiteId");
    const scheduleRow = scheduleResult.recordset[0];

    if (scheduleRow?.ScheduleType === "Disabled") {
      // Admin explicitly turned off all automatic scanning for this website - manual "Scan
      // now" still works, this only skips the scheduled/default path entirely.
      continue;
    }

    if (scheduleRow) {
      // Custom per-website schedule — overrides the default entirely for this website.
      const schedule: ScanSchedule = {
        scheduleType: scheduleRow.ScheduleType as ScanSchedule["scheduleType"],
        timesPerDay: scheduleRow.TimesPerDay,
        scanTimes: parseScanTimes(scheduleRow.ScanTimes),
        repeatIntervalDays: scheduleRow.RepeatIntervalDays,
        dayOfWeek: scheduleRow.DayOfWeek,
        dayOfMonth: scheduleRow.DayOfMonth,
        monthOfYear: scheduleRow.MonthOfYear,
        lastRunAt: scheduleRow.LastRunAt ? new Date(scheduleRow.LastRunAt) : null,
      };

      if (!isScheduleDue(schedule, now)) continue;

      await db.request().input("websiteId", sql.Int, website.Id).query(
        "UPDATE WebsiteScanSchedules SET LastRunAt = SYSUTCDATETIME() WHERE WebsiteId = @websiteId"
      );

      // A custom-scheduled scan is allowed to replace today's already-completed scan (if
      // any) since it's an intentional, admin-configured re-scan cadence, not a "did we
      // already do this today" default check.
      await db
        .request()
        .input("websiteId", sql.Int, website.Id)
        .query("DELETE FROM WebsiteAuditScans WHERE WebsiteId = @websiteId AND ScanDate = CAST(SYSUTCDATETIME() AS DATE)");

      await runScanForWebsite(website, "scheduled-scan-custom");
      continue;
    }

    // No custom schedule — unchanged default behavior: once daily, ~02:00.
    if (!timeMatchesNow(now, DEFAULT_SCAN_TIME, 10)) continue;

    const already = await db
      .request()
      .input("websiteId", sql.Int, website.Id)
      .query<{ Id: number; Status: string }>(
        "SELECT Id, Status FROM WebsiteAuditScans WHERE WebsiteId = @websiteId AND ScanDate = CAST(SYSUTCDATETIME() AS DATE)"
      );
    if (already.recordset[0]?.Status === "Completed") continue;
    if (already.recordset[0]) {
      await db
        .request()
        .input("websiteId", sql.Int, website.Id)
        .query("DELETE FROM WebsiteAuditScans WHERE WebsiteId = @websiteId AND ScanDate = CAST(SYSUTCDATETIME() AS DATE)");
    }

    await runScanForWebsite(website, "scheduled-scan-default");
  }

  await purgeOldData();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
