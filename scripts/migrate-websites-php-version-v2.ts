import "dotenv/config";
import { getDb } from "../src/lib/db";
import type { ConnectionPool } from "mssql";

async function addColumnIfMissing(db: ConnectionPool, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

// Separates "fetched fine, no PHP header present" (PhpVersion/PhpVersionScanError both null)
// from "the scan itself couldn't reach the site" (PhpVersionScanError holds a short reason,
// e.g. "Timed out") - the two look identical from PhpVersion alone, but mean very different
// things: the first is a real negative result, the second means "we don't actually know yet."
async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "Websites", "PhpVersionScanError", "NVARCHAR(200) NULL");

  console.log("Websites.PhpVersionScanError column ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
