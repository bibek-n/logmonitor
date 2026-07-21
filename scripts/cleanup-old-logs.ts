import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

// Deletes log rows past the retention window, in small batches rather than one giant DELETE -
// these tables can hold tens of millions of rows, and a single unbatched DELETE would take an
// enormous transaction log and hold locks for the whole duration, which is exactly the kind of
// thing that would visibly stall this app's other writes (agent uploads, syslog ingestion)
// mid-run. Meant to be run on a recurring schedule (see the operator note at the bottom of this
// file for how to wire that up) - safe to re-run any time, since it always deletes are_relative
// to "now", not a fixed cutoff.
const RETENTION_DAYS = 45;
const BATCH_SIZE = 20000;

interface CleanupTarget {
  table: string;
  dateColumn: string;
}

const TARGETS: CleanupTarget[] = [
  { table: "WebFilterLogs", dateColumn: "ReceivedAt" },
  { table: "ServerLogEntries", dateColumn: "ReceivedAt" },
  { table: "RouterWebLogs", dateColumn: "ReceivedAt" },
  { table: "SecurityEvents", dateColumn: "CreatedAt" },
  { table: "SophosThreatLogs", dateColumn: "ReceivedAt" },
  { table: "SophosEventLogs", dateColumn: "ReceivedAt" },
];

async function cleanupTable(target: CleanupTarget): Promise<number> {
  const db = await getDb();
  let totalDeleted = 0;

  for (;;) {
    const result = await db
      .request()
      .input("days", sql.Int, RETENTION_DAYS)
      .input("batchSize", sql.Int, BATCH_SIZE)
      .query(`
        DELETE TOP (@batchSize) FROM [${target.table}]
        WHERE [${target.dateColumn}] < DATEADD(DAY, -@days, SYSUTCDATETIME())
      `);
    const deleted = result.rowsAffected[0] ?? 0;
    totalDeleted += deleted;
    if (deleted < BATCH_SIZE) break;
  }

  return totalDeleted;
}

async function main() {
  console.log(`Cleaning up log tables older than ${RETENTION_DAYS} days...`);
  for (const target of TARGETS) {
    const start = Date.now();
    try {
      const deleted = await cleanupTable(target);
      console.log(`${target.table}: deleted ${deleted} rows in ${((Date.now() - start) / 1000).toFixed(0)}s`);
    } catch (err) {
      // A table missing the expected date column (or not existing on some deployments) skips
      // rather than aborting the whole run - the other targets still need to run.
      console.error(`${target.table}: FAILED -`, err instanceof Error ? err.message : err);
    }
  }
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// To run automatically: schedule this via Windows Task Scheduler on the server (e.g. daily at
// 03:00) running `npx tsx scripts\cleanup-old-logs.ts` from D:\WWWROOT\LogMonitor - not wired
// up as part of this change; needs to be registered on the server directly.
