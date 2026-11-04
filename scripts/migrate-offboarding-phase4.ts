import "dotenv/config";
import { getDb } from "../src/lib/db";

// Employee Offboarding Phase 4: fixes a real bug surfaced by Teamwork's own API response on a
// live retry - "Could not revoke access; retry with the same request_id" - meaning request_id
// must be stable across retries for the same offboarding attempt, not freshly randomized on
// every call as originally assumed. One UUID is now generated per OffboardingActions row (at
// INSERT time, via SQL Server's own NEWID()) and reused for every Teamwork call made while
// retrying that same row, instead of offboardingService.ts asking teamworkClient.ts to mint a
// new one on every attempt.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OffboardingActions') AND name = 'TeamworkRequestId')
    ALTER TABLE OffboardingActions ADD TeamworkRequestId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()
  `;

  console.log("Offboarding module Phase 4 schema ready (TeamworkRequestId on OffboardingActions, stable across retries).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
