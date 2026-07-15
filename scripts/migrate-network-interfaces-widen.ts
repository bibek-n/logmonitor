import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  // Real machine hit this live: a virtual/tunnel network adapter on fileserver-PC reported
  // MAC "00:00:00:00:00:00:00" - longer than a real MAC and wider than the VARCHAR(20) this
  // column was sized for - which threw a 500 on every hardware upload containing that
  // interface, and (before the per-item try/catch fix in the hardware route) took every
  // other interface on that device down with it.
  await db.query`
    ALTER TABLE DeviceNetworkInterfaces ALTER COLUMN MacAddress VARCHAR(64) NULL
  `;

  console.log("DeviceNetworkInterfaces.MacAddress widened.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
