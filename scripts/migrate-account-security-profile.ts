import "dotenv/config";
import { getDb } from "../src/lib/db";

async function addColumnIfMissing(db: Awaited<ReturnType<typeof getDb>>, table: string, column: string, definition: string) {
  await db.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${definition}
  `);
}

async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "Users", "PasswordChangedAt", "DATETIME2 NULL");
  await addColumnIfMissing(db, "Users", "RecoveryPhone", "NVARCHAR(30) NULL");
  await addColumnIfMissing(db, "Users", "RecoveryEmail", "NVARCHAR(200) NULL");
  // Stored preference only, same as the existing MfaRequired column - not yet wired into
  // the actual login flow. Surfaced in the account security checklist so the intent is
  // recorded even before login behavior changes to honor it.
  await addColumnIfMissing(db, "Users", "SkipPasswordWhenPossible", "BIT NOT NULL DEFAULT 0");

  console.log("Users.PasswordChangedAt/RecoveryPhone/RecoveryEmail/SkipPasswordWhenPossible ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
