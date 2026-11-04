import "dotenv/config";
import { getDb } from "../src/lib/db";
import type { ConnectionPool } from "mssql";

async function addColumnIfMissing(db: ConnectionPool, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

// Lets an admin record a PHP version they know from somewhere else (hosting control panel,
// direct SSH check, etc) when the live header doesn't disclose it. PhpVersionManual marks
// that row so "Scan All"/"Scan Selected" skip overwriting it - only clearing the override or
// explicitly clicking that row's own "Scan" button hands control back to auto-detection.
async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "Websites", "PhpVersionManual", "BIT NOT NULL DEFAULT 0");

  console.log("Websites.PhpVersionManual column ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
