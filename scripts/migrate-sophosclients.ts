import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SophosClients' AND xtype='U')
    CREATE TABLE SophosClients (
      IpAddress VARCHAR(45) NOT NULL PRIMARY KEY,
      MacAddress VARCHAR(20) NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  console.log("SophosClients table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
