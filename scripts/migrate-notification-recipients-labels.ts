import "dotenv/config";
import { getDb, sql } from "../src/lib/db";
import type { ConnectionPool } from "mssql";
import { NOTIFICATION_MODULES } from "../src/lib/notificationRecipients";

async function addColumnIfMissing(db: ConnectionPool, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

// Lets Settings > Notifications show a real label for a custom, admin-added module (there's
// no code registry entry to look one up for those, unlike the 5 built-in NOTIFICATION_MODULES
// rows) - going forward every row, built-in or custom, carries its own display labels rather
// than the frontend having to merge DB rows against the static registry to find a name.
async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "NotificationRecipients", "ModuleLabel", "NVARCHAR(200) NULL");
  await addColumnIfMissing(db, "NotificationRecipients", "SubModuleLabel", "NVARCHAR(200) NULL");

  for (const mod of NOTIFICATION_MODULES) {
    await db
      .request()
      .input("moduleKey", sql.VarChar, mod.moduleKey)
      .input("subModuleKey", sql.VarChar, mod.subModuleKey)
      .input("moduleLabel", sql.NVarChar, mod.moduleLabel)
      .input("subModuleLabel", sql.NVarChar, mod.subModuleLabel)
      .query(`
        UPDATE NotificationRecipients SET ModuleLabel = @moduleLabel, SubModuleLabel = @subModuleLabel
        WHERE ModuleKey = @moduleKey AND SubModuleKey = @subModuleKey AND ModuleLabel IS NULL
      `);
  }

  console.log("NotificationRecipients.ModuleLabel/SubModuleLabel backfilled for built-in modules.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
