import "dotenv/config";
import { getDb } from "../src/lib/db";

// The user supplied a full 36-item "standard" run type list. 27 of those names already exist
// (8 from migrate-qa-test-run-types.ts: Smoke/Regression/Release/Security/Browser
// Compatibility/Mobile/Production Verification/Custom, and 19 more from
// migrate-qa-advanced-run-types.ts: Load/Stress/Spike/Endurance/Scalability/Failover/Recovery/
// Backup and Restore/Network Failure/Session and Concurrency/Permission and Role/Data
// Migration/Installation/Accessibility/Usability/Localization/Audit and Logging/Notification/
// Chaos). This script seeds the 9 names that are genuinely new — deliberately kept as distinct
// entries from their closest existing cousin (API Test vs. API Reliability Test, Database Test
// vs. Database Integrity Test, Upgrade Test vs. Upgrade and Downgrade Test, File Upload Test
// vs. File Upload Security Test) since the user named them separately, not as renames.

const STANDARD_RUN_TYPES: { name: string; description: string }[] = [
  { name: "Functional Test", description: "Verifies each feature works according to its functional requirements." },
  { name: "Sanity Test", description: "Quick, narrow check that a specific fix or feature works after a minor change." },
  { name: "Integration Test", description: "Verifies that different modules or services work correctly together." },
  { name: "System Test", description: "Verifies the fully integrated system meets its overall requirements end-to-end." },
  { name: "User Acceptance Test", description: "Verifies the application meets business needs from an end-user's perspective before release." },
  { name: "API Test", description: "Verifies API endpoints return correct responses, status codes, and data contracts." },
  { name: "Database Test", description: "Verifies data storage, retrieval, and query correctness at the database level." },
  { name: "Upgrade Test", description: "Verifies the application functions correctly after upgrading to a new version." },
  { name: "File Upload Test", description: "Verifies file uploads work correctly for supported types, sizes, and edge cases." },
];

async function main() {
  const db = await getDb();

  for (const rt of STANDARD_RUN_TYPES) {
    const existing = await db.query<{ Cnt: number }>`SELECT COUNT(*) AS Cnt FROM QaTestRunTypes WHERE Name = ${rt.name}`;
    if (existing.recordset[0].Cnt === 0) {
      await db.query`INSERT INTO QaTestRunTypes (Name, Description) VALUES (${rt.name}, ${rt.description})`;
      console.log(`  seeded: ${rt.name}`);
    } else {
      console.log(`  already present: ${rt.name}`);
    }
  }

  console.log("Standard run types migration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
