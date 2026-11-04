import "dotenv/config";
import { getDb } from "../src/lib/db";
import type { ConnectionPool } from "mssql";

async function addColumnIfMissing(db: ConnectionPool, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

// Lets an admin record a platform + version pulled from somewhere other than the live scan
// (e.g. package.json for a Next.js app, or wp-admin for a WordPress site that strips the
// <meta name="generator"> tag). PlatformVersionManual marks that row so a PHP rescan doesn't
// clobber it - mirrors PhpVersionManual (migrate-websites-php-version-v4.ts), just for the
// Platform/PlatformVersion columns instead of PhpVersion.
async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "Websites", "PlatformVersionManual", "BIT NOT NULL DEFAULT 0");

  console.log("Websites.PlatformVersionManual column ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
