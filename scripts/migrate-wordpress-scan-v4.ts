import "dotenv/config";
import { getDb } from "../src/lib/db";

// Adds BlockReason to the existing WordPressDeepScans table (see
// src/lib/wordpressScan/detect.ts's looksLikeAntiBotChallenge). Set only on scans where the
// page fetched looked like an anti-bot/JS-challenge interstitial rather than real content, so
// the UI can say "scan was blocked" instead of the misleading "WordPress was not detected" for
// those rows. NULL for every other scan, including every pre-existing row. Idempotent - safe
// to run multiple times.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('WordPressDeepScans') AND name = 'BlockReason')
    ALTER TABLE WordPressDeepScans ADD BlockReason NVARCHAR(500) NULL
  `;

  console.log("WordPressDeepScans.BlockReason column ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
