import "dotenv/config";
import { getDb } from "../src/lib/db";

// Stores the per-region breakdown (Europe/USA/India, via check-host.net) that now decides a
// website monitor's actual Up/Down/Degraded status - added after discovering that a single
// vantage point (this app's own server) can get a false Down from a local network issue
// (blocked DNS/TCP to a specific site) even though the site is reachable from everywhere else.
// Nullable/JSON so it's purely additive - a row with no region data (an older check, or a
// check-host.net outage falling back to local-only) still reads fine.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('MonitorResults') AND name = 'RegionCheckResultsJson')
    ALTER TABLE MonitorResults ADD RegionCheckResultsJson NVARCHAR(MAX) NULL
  `;

  console.log("MonitorResults.RegionCheckResultsJson column ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
