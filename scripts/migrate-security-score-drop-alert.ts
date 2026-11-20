import "dotenv/config";
import { getDb } from "../src/lib/db";

async function addColumnIfMissing(db: Awaited<ReturnType<typeof getDb>>, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

// "Alert on drop" setting, added onto the same SecurityNotificationSettings singleton row
// slice 3 created (quiet hours/escalation/digest) rather than a new table. Idempotent.
async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "SecurityNotificationSettings", "ScoreDropThreshold", "INT NOT NULL DEFAULT 10");
  await addColumnIfMissing(db, "SecurityNotificationSettings", "LastScoreDropAlertAt", "DATETIME2 NULL");

  console.log("SecurityNotificationSettings.ScoreDropThreshold/LastScoreDropAlertAt ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
