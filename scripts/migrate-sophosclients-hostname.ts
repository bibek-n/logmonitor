import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (
      SELECT * FROM sys.columns
      WHERE object_id = OBJECT_ID('SophosClients') AND name = 'Hostname'
    )
    ALTER TABLE SophosClients ADD Hostname NVARCHAR(200) NULL
  `;

  console.log("SophosClients.Hostname column ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
