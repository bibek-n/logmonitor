import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Devices') AND name = 'MacAddress')
    ALTER TABLE Devices ADD MacAddress VARCHAR(20) NULL
  `;

  console.log("Devices.MacAddress column ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
