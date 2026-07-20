import "dotenv/config";
import { getDb } from "../src/lib/db";

// Computer Name is normally derived live (RouterClients/SophosClients hostname joined by
// MAC — see getStaffWithStatus in src/lib/staffStatus.ts). This nullable column lets an
// admin override that auto-detected name from the Edit Employee modal; when NULL, the
// derived name is used exactly as before, so existing staff/devices are unaffected.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'ComputerNameOverride')
    ALTER TABLE Staff ADD ComputerNameOverride NVARCHAR(255) NULL
  `;

  console.log("Staff.ComputerNameOverride column ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
