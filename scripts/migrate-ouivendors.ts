import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OuiVendors' AND xtype='U')
    CREATE TABLE OuiVendors (
      Prefix VARCHAR(6) NOT NULL PRIMARY KEY,
      VendorName NVARCHAR(300) NOT NULL
    )
  `;

  console.log("OuiVendors table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
