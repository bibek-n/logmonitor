import "dotenv/config";
import { getDb } from "../src/lib/db";
import type { ConnectionPool } from "mssql";

async function addColumnIfMissing(db: ConnectionPool, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

// Backs the "make it workable" rebuild of the WordPress Deep Scan tool: PhpVersion (reused
// from the Websites list's own PHP Version column, not re-detected here) and
// LatestCoreVersion (from WordPress.org's free update-check API, wpOrgApi.ts) let the report
// and scan history show "old PHP version" and "upgrade to X" without needing the paid/token-
// gated WPScan vulnerability-database API at all.
async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "WordPressDeepScans", "PhpVersion", "NVARCHAR(50) NULL");
  await addColumnIfMissing(db, "WordPressDeepScans", "LatestCoreVersion", "NVARCHAR(50) NULL");

  console.log("WordPressDeepScans.PhpVersion / LatestCoreVersion columns ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
