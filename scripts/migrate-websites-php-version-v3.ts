import "dotenv/config";
import { getDb } from "../src/lib/db";
import type { ConnectionPool } from "mssql";

async function addColumnIfMissing(db: ConnectionPool, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

// Platform/PlatformVersion cover non-PHP tech stacks (Next.js, WordPress, Laravel, ASP.NET,
// ...) that don't have their own dedicated column the way PHP does. PlatformVersion is only
// ever populated when a real version was found (WordPress generator tag today) - most
// platforms (Next.js, React, Node.js) have no passively-readable version at all, so null
// here is the honest answer, not a missed detection. ServerHeader is the raw Server response
// header, kept as a fallback label (nginx/1.18.0, cloudflare, openresty/1.31.1.1, ...) for
// when nothing more specific was found.
async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "Websites", "Platform", "NVARCHAR(50) NULL");
  await addColumnIfMissing(db, "Websites", "PlatformVersion", "NVARCHAR(100) NULL");
  await addColumnIfMissing(db, "Websites", "ServerHeader", "NVARCHAR(150) NULL");

  console.log("Websites.Platform / PlatformVersion / ServerHeader columns ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
