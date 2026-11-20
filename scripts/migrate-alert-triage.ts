import "dotenv/config";
import { getDb } from "../src/lib/db";

async function addColumnIfMissing(db: Awaited<ReturnType<typeof getDb>>, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

// Alert Triage Center, slice 1: ownership + acknowledgement on the existing SecurityAlerts
// table (which already has severity, dedup, status, and a history timeline - see
// migrate-intrusion-detection.ts). Mirrors the Incidents table's AssignedToUserId /
// AcknowledgedAt / AcknowledgedByUserId columns (src/lib/websiteApiMonitoring/incidentService.ts)
// rather than inventing a new shape. No FK constraint on the two UserId columns, same as
// every other UserId/Username pair already on SecurityAlertStatusHistory - this app's Users
// table has no referential-integrity convention enforced from this module. Idempotent.
async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "SecurityAlerts", "AssignedToUserId", "INT NULL");
  await addColumnIfMissing(db, "SecurityAlerts", "AcknowledgedAt", "DATETIME2 NULL");
  await addColumnIfMissing(db, "SecurityAlerts", "AcknowledgedByUserId", "INT NULL");

  console.log("SecurityAlerts triage columns (AssignedToUserId, AcknowledgedAt, AcknowledgedByUserId) ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
