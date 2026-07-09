import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (
      SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('RouterClients') AND name = 'FirstSeen'
    )
    ALTER TABLE RouterClients ADD FirstSeen DATETIME2 NULL
  `;
  await db.query`UPDATE RouterClients SET FirstSeen = UpdatedAt WHERE FirstSeen IS NULL`;

  await db.query`
    IF NOT EXISTS (
      SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('SophosClients') AND name = 'FirstSeen'
    )
    ALTER TABLE SophosClients ADD FirstSeen DATETIME2 NULL
  `;
  await db.query`UPDATE SophosClients SET FirstSeen = UpdatedAt WHERE FirstSeen IS NULL`;

  console.log("FirstSeen column ready on RouterClients and SophosClients (backfilled from UpdatedAt for existing rows).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
