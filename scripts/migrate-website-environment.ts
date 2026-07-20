import "dotenv/config";
import { getDb } from "../src/lib/db";
import type { ConnectionPool } from "mssql";

async function addColumnIfMissing(db: ConnectionPool, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

// Environment tags a saved website as Live/Staging/Dev - defaults every existing row to
// 'Live' since that's what they all were before this column existed (nothing in this app
// previously distinguished environments, so "Live" is the accurate backfill, not a guess).
async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "Websites", "Environment", "NVARCHAR(20) NOT NULL DEFAULT 'Live'");

  console.log("Websites.Environment column ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
