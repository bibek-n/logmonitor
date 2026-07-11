import "dotenv/config";
import { getDb } from "../src/lib/db";
import type { ConnectionPool } from "mssql";

async function addColumnIfMissing(db: ConnectionPool, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "EnrollmentTokens", "StaffId", "INT NULL");

  // ON DELETE SET NULL (unlike Devices.StaffId's FK, which has no delete action) — a token
  // is disposable history, so deleting an employee should never be blocked by one merely
  // referencing them.
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_EnrollmentTokens_Staff')
    ALTER TABLE EnrollmentTokens ADD CONSTRAINT FK_EnrollmentTokens_Staff
      FOREIGN KEY (StaffId) REFERENCES Staff(Id) ON DELETE SET NULL
  `);

  console.log("EnrollmentTokens.StaffId column ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
