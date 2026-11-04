import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();
  await db.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserMenuAccess')
    CREATE TABLE UserMenuAccess (
      Id INT IDENTITY PRIMARY KEY,
      UserId INT NOT NULL REFERENCES Users(Id) ON DELETE CASCADE,
      MenuKey NVARCHAR(150) NOT NULL,
      Allowed BIT NOT NULL,
      CONSTRAINT UQ_UserMenuAccess UNIQUE (UserId, MenuKey)
    )
  `);
  console.log("UserMenuAccess table ready.");
  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
