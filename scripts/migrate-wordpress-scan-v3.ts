import "dotenv/config";
import { getDb } from "../src/lib/db";

// Adds scan-profile support to the existing WordPressDeepScans table (see
// src/lib/wordpressScan/shared.ts's ScanProfile). Idempotent — safe to run multiple times.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('WordPressDeepScans') AND name = 'Profile')
    ALTER TABLE WordPressDeepScans ADD Profile VARCHAR(20) NULL
  `;

  // Backfill existing rows: every scan taken before profiles existed ran every check, i.e.
  // what is now called "comprehensive".
  await db.query`
    UPDATE WordPressDeepScans SET Profile = 'comprehensive' WHERE Profile IS NULL
  `;

  console.log("WordPressDeepScans.Profile column ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
