import "dotenv/config";
import { getDb } from "../src/lib/db";
import type { ConnectionPool } from "mssql";

async function addColumnIfMissing(db: ConnectionPool, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

// Identifies which device+site an "AgentWebLog" SecurityLogSources row was auto-registered
// for, so a later batch from the same device+site reuses the same row instead of creating a
// duplicate. NULL for every pre-existing pull-based adapter row (Sophos, this app's own IIS
// log, admin audit log) - this only ever gets populated by the new agent-push ingestion path.
async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "SecurityLogSources", "SourceDeviceId", "VARCHAR(36) NULL");
  await addColumnIfMissing(db, "SecurityLogSources", "SourceSiteName", "NVARCHAR(200) NULL");

  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UX_SecurityLogSources_SourceDeviceId_SourceSiteName')
    CREATE UNIQUE INDEX UX_SecurityLogSources_SourceDeviceId_SourceSiteName
      ON SecurityLogSources (SourceDeviceId, SourceSiteName)
      WHERE SourceDeviceId IS NOT NULL AND SourceSiteName IS NOT NULL
  `);

  // SecurityEvents (2.4M+ rows already) has never had an index on LogSourceId - every query
  // that says "show me what this specific log source collected" (per-source drill-down, this
  // migration's own verification, and any future per-source view) was doing a full clustered
  // scan. Pre-existing gap, unrelated to the schema change above, but this feature is the one
  // that's about to make LogSourceId-filtered queries common (one row per server instead of
  // effectively one shared source today), so it needs to actually be fast now.
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SecurityEvents_LogSourceId')
    CREATE INDEX IX_SecurityEvents_LogSourceId ON SecurityEvents (LogSourceId, EventTime DESC)
  `);

  console.log("SecurityLogSources.SourceDeviceId/SourceSiteName columns ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
