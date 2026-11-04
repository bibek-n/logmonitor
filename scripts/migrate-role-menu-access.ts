import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();
  await db.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RoleMenuAccess')
    CREATE TABLE RoleMenuAccess (
      Id INT IDENTITY PRIMARY KEY,
      RoleId INT NOT NULL REFERENCES Roles(Id) ON DELETE CASCADE,
      MenuKey NVARCHAR(150) NOT NULL,
      Allowed BIT NOT NULL,
      CONSTRAINT UQ_RoleMenuAccess UNIQUE (RoleId, MenuKey)
    )
  `);
  console.log("RoleMenuAccess table ready.");
  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
