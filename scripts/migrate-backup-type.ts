import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BackupHistory') AND name = 'BackupType')
    ALTER TABLE BackupHistory ADD BackupType NVARCHAR(20) NOT NULL DEFAULT 'database'
  `);

  console.log("BackupHistory.BackupType ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
