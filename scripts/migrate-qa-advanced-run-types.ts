import "dotenv/config";
import { getDb } from "../src/lib/db";

// Adds 25 advanced/non-functional run types on top of the 8 seeded by
// migrate-qa-test-run-types.ts (Smoke/Regression/Release/Security/Browser Compatibility/
// Mobile/Production Verification/Custom). No schema change — QaTestRunTypes already exists —
// this is purely additional seed data, so it's a separate idempotent script rather than an
// edit to the earlier one, matching how migrate-qa-workflow-gates.ts followed
// migrate-qa-testing.ts as its own step.

const ADVANCED_RUN_TYPES: { name: string; description: string }[] = [
  { name: "Load Test", description: "Verifies system performance under expected concurrent user or traffic load." },
  { name: "Stress Test", description: "Pushes the system beyond normal capacity to find its breaking point." },
  { name: "Spike Test", description: "Checks system behavior under a sudden, sharp increase in load." },
  { name: "Endurance Test", description: "Verifies system stability and resource usage over a sustained period." },
  { name: "Scalability Test", description: "Checks how the system performs as load or data volume scales up." },
  { name: "Failover Test", description: "Verifies the system switches to a backup or redundant component without data loss." },
  { name: "Recovery Test", description: "Verifies the system recovers correctly after a crash or failure." },
  { name: "Backup and Restore Test", description: "Verifies backups are created correctly and data restores without loss." },
  { name: "Database Integrity Test", description: "Checks referential integrity, constraints, and data consistency in the database." },
  { name: "API Reliability Test", description: "Verifies API endpoints respond correctly and consistently under repeated calls." },
  { name: "Network Failure Test", description: "Checks system behavior under network latency, packet loss, or disconnection." },
  { name: "Session and Concurrency Test", description: "Verifies correct behavior under multiple simultaneous user sessions." },
  { name: "Permission and Role Test", description: "Verifies access is correctly granted or denied per user role and permission." },
  { name: "Data Migration Test", description: "Verifies data transfers correctly between schemas, versions, or systems." },
  { name: "Upgrade and Downgrade Test", description: "Verifies the application functions correctly after a version upgrade or rollback." },
  { name: "Installation Test", description: "Verifies the application installs correctly on a clean target environment." },
  { name: "Configuration Test", description: "Verifies the application behaves correctly across different configuration settings." },
  { name: "Compatibility Test", description: "Checks the application works correctly across different platforms and environments." },
  { name: "Accessibility Test", description: "Verifies the application meets accessibility standards, e.g. screen readers and keyboard navigation." },
  { name: "Usability Test", description: "Verifies the application is intuitive and easy to use for real users." },
  { name: "Localization Test", description: "Verifies the application displays and functions correctly in different languages and locales." },
  { name: "Audit and Logging Test", description: "Verifies actions are correctly recorded in audit logs for traceability." },
  { name: "Notification Test", description: "Verifies notifications (email, SMS, push, in-app) are triggered and delivered correctly." },
  { name: "File Upload Security Test", description: "Verifies file uploads reject malicious or invalid files and enforce size and type limits." },
  { name: "Chaos Test", description: "Injects random failures into the system to verify resilience and graceful degradation." },
];

async function main() {
  const db = await getDb();

  for (const rt of ADVANCED_RUN_TYPES) {
    const existing = await db.query<{ Cnt: number }>`SELECT COUNT(*) AS Cnt FROM QaTestRunTypes WHERE Name = ${rt.name}`;
    if (existing.recordset[0].Cnt === 0) {
      await db.query`INSERT INTO QaTestRunTypes (Name, Description) VALUES (${rt.name}, ${rt.description})`;
      console.log(`  seeded: ${rt.name}`);
    } else {
      console.log(`  already present: ${rt.name}`);
    }
  }

  console.log("Advanced run types migration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
