import "dotenv/config";
import { getDb } from "../src/lib/db";
import type { ConnectionPool } from "mssql";

async function addColumnIfMissing(db: ConnectionPool, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

// PhpVersion/PhpVersionCheckedAt are nullable and only ever populated by an explicit scan
// (per-row "Scan" button or "Scan All") - a site that was never scanned, or isn't PHP at
// all, legitimately has no value here rather than a guessed default.
async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "Websites", "PhpVersion", "NVARCHAR(50) NULL");
  await addColumnIfMissing(db, "Websites", "PhpVersionCheckedAt", "DATETIME2 NULL");

  console.log("Websites.PhpVersion / PhpVersionCheckedAt columns ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
