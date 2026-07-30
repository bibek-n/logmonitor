import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  const before = await db.query(`
    SELECT name, is_read_committed_snapshot_on FROM sys.databases WHERE database_id = DB_ID()
  `);
  console.log("Before:", JSON.stringify(before.recordset[0]));

  console.log("Enabling READ_COMMITTED_SNAPSHOT...");
  await db.query(`ALTER DATABASE [LogMonitor] SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE`);

  const after = await db.query(`
    SELECT name, is_read_committed_snapshot_on FROM sys.databases WHERE database_id = DB_ID()
  `);
  console.log("After:", JSON.stringify(after.recordset[0]));

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
