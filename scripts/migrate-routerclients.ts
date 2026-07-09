import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RouterClients' AND xtype='U')
    CREATE TABLE RouterClients (
      IpAddress VARCHAR(45) NOT NULL PRIMARY KEY,
      MacAddress VARCHAR(20) NULL,
      Hostname NVARCHAR(200) NULL,
      Status NVARCHAR(30) NULL,
      LastSeenRaw NVARCHAR(30) NULL,
      ExpiresAfterRaw NVARCHAR(30) NULL,
      FirstSeenAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  console.log("RouterClients table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
