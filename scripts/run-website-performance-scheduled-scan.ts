import "dotenv/config";
import { getDb } from "../src/lib/db";
import { runPerformanceTest } from "../src/lib/websitePerformance/runTest";

// Meant to be invoked frequently (every 5-15 minutes) by a Windows Scheduled Task running
// run-website-performance-scheduled-scan.ps1, same pattern as
// run-website-security-daily-scan.ps1/scan:website-security. Unlike that script's fixed daily
// time-of-day window, this one is interval-based (Every15Min/Hourly/Daily/etc.), so due-ness
// is computed from "how long since the last completed scan for this website" rather than a
// specific clock time - no separate LastRunAt column needed, the scan history itself is the
// source of truth.
const INTERVAL_MINUTES: Record<string, number> = {
  Every15Min: 15,
  Every30Min: 30,
  Hourly: 60,
  Every6Hours: 6 * 60,
  Every12Hours: 12 * 60,
  Daily: 24 * 60,
  Custom: 24 * 60, // Custom cron isn't interpreted yet - falls back to once daily.
};

interface DueRow {
  WebsiteId: number;
  Name: string;
  ScheduleType: string;
  LastCompletedAt: string | null;
}

async function main() {
  const db = await getDb();

  const result = await db.query<DueRow>(`
    SELECT w.Id AS WebsiteId, w.Name, cfg.ScheduleType,
      (SELECT MAX(s.CreatedAt) FROM WebsitePerformanceScans s WHERE s.WebsiteId = w.Id AND s.Status = 'Completed') AS LastCompletedAt
    FROM Websites w
    JOIN WebsitePerformanceConfigs cfg ON cfg.WebsiteId = w.Id
    WHERE w.Enabled = 1 AND cfg.Enabled = 1
  `);

  const now = Date.now();
  let triggered = 0;

  for (const row of result.recordset) {
    const intervalMinutes = INTERVAL_MINUTES[row.ScheduleType] ?? 24 * 60;
    const dueAgo = !row.LastCompletedAt || now - new Date(row.LastCompletedAt).getTime() >= intervalMinutes * 60 * 1000;
    if (!dueAgo) continue;

    console.log(`[website-performance-scheduler] ${row.Name}: due (schedule=${row.ScheduleType}) - running...`);
    try {
      const results = await runPerformanceTest({ websiteId: row.WebsiteId, triggeredBy: "Scheduled" });
      for (const r of results) {
        console.log(`[website-performance-scheduler] ${row.Name} (${r.device}): ${r.status} - score ${r.overallScore ?? "n/a"}`);
      }
      triggered += 1;
    } catch (err) {
      console.error(`[website-performance-scheduler] ${row.Name}: FAILED -`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[website-performance-scheduler] done - triggered ${triggered} website(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
