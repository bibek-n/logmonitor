import "dotenv/config";
import { getDb, sql } from "../src/lib/db";
import { getBrowserActivitySettings, deleteEventsOlderThan } from "../src/lib/browserActivity/repository";

// Kept as its own script rather than folded into cleanup-old-logs.ts - that script's
// RETENTION_DAYS is a fixed constant, while this module's retention period is admin-configured
// (BrowserActivitySettings.RetentionDays, editable on the module's own Settings page), so the
// value has to be read live on every run rather than hardcoded alongside the other tables.
const BATCH_SIZE = 20000;

// Every automated deletion is itself written to AdminAuditLog (Section='browser-activity') -
// see the approved plan's audit trail section: for a monitoring module, even automatic data
// removal should be visible in the same trail as manual views/exports/edits, not silent.
async function recordCleanupRun(deleted: number, retentionDays: number): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("section", sql.NVarChar, "browser-activity")
    .input("action", sql.NVarChar, "retention_cleanup")
    .input("details", sql.NVarChar, `Deleted ${deleted} row(s) older than ${retentionDays} day(s) (scheduled retention cleanup)`)
    .query(
      "INSERT INTO AdminAuditLog (UserId, Username, Section, Action, Details, IpAddress) VALUES (NULL, 'system', @section, @action, @details, NULL)"
    );
}

async function main() {
  const settings = await getBrowserActivitySettings();
  console.log(`Browser Activity retention cleanup: deleting events older than ${settings.retentionDays} day(s)...`);

  let totalDeleted = 0;
  for (;;) {
    const deleted = await deleteEventsOlderThan(settings.retentionDays, BATCH_SIZE);
    totalDeleted += deleted;
    if (deleted < BATCH_SIZE) break;
  }

  console.log(`Browser Activity retention cleanup: deleted ${totalDeleted} row(s).`);
  await recordCleanupRun(totalDeleted, settings.retentionDays);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// To run automatically: schedule this via Windows Task Scheduler on the server (e.g. daily at
// 03:15, right after the other nightly cleanup jobs) running
// `npx tsx scripts\cleanup-browser-activity.ts` from D:\WWWROOT\LogMonitor, or use the
// run-browser-activity-cleanup.ps1 wrapper - not wired up as part of this change; needs to be
// registered on the server directly.
