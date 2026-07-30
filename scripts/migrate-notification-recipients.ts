import "dotenv/config";
import { getDb, sql } from "../src/lib/db";
import { NOTIFICATION_MODULES } from "../src/lib/notificationRecipients";

// Seeds one row per known module/sub-module with the same recipient this app already used
// as its non-support fallback (bibek@tulipstechnologies.com) - preserves existing alerting
// behavior while dropping the hardcoded support@websearchpro.net address for good. Existing
// rows are left untouched on re-run so an admin's own edits in Settings > Notifications never
// get overwritten by re-running this migration.
const DEFAULT_RECIPIENT = "bibek@tulipstechnologies.com";

async function main() {
  const db = await getDb();

  await db.query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='NotificationRecipients' AND xtype='U')
    CREATE TABLE NotificationRecipients (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ModuleKey VARCHAR(50) NOT NULL,
      SubModuleKey VARCHAR(50) NOT NULL DEFAULT '',
      Recipients NVARCHAR(1000) NOT NULL DEFAULT '',
      Enabled BIT NOT NULL DEFAULT 1,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      CONSTRAINT UQ_NotificationRecipients_Module UNIQUE (ModuleKey, SubModuleKey)
    )
  `);

  for (const mod of NOTIFICATION_MODULES) {
    const existing = await db
      .request()
      .input("moduleKey", sql.VarChar, mod.moduleKey)
      .input("subModuleKey", sql.VarChar, mod.subModuleKey)
      .query("SELECT Id FROM NotificationRecipients WHERE ModuleKey = @moduleKey AND SubModuleKey = @subModuleKey");

    if (existing.recordset.length === 0) {
      await db
        .request()
        .input("moduleKey", sql.VarChar, mod.moduleKey)
        .input("subModuleKey", sql.VarChar, mod.subModuleKey)
        .input("recipients", sql.NVarChar, DEFAULT_RECIPIENT)
        .query("INSERT INTO NotificationRecipients (ModuleKey, SubModuleKey, Recipients, Enabled) VALUES (@moduleKey, @subModuleKey, @recipients, 1)");
      console.log(`Seeded NotificationRecipients row for ${mod.moduleKey}${mod.subModuleKey ? `/${mod.subModuleKey}` : ""}.`);
    }
  }

  console.log("NotificationRecipients table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
