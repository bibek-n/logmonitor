import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (
      SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('RouterClients') AND name = 'Os'
    )
    ALTER TABLE RouterClients ADD Os NVARCHAR(50) NULL
  `;

  await db.query`
    IF NOT EXISTS (
      SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('SophosClients') AND name = 'Os'
    )
    ALTER TABLE SophosClients ADD Os NVARCHAR(50) NULL
  `;

  console.log("Os column ready on RouterClients and SophosClients.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
