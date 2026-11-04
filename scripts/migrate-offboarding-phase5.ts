import "dotenv/config";
import { getDb } from "../src/lib/db";

// Employee Offboarding Phase 5: adds LogMonitor itself (this app) as a fifth system. Unlike the
// other four, this needs no external API/credentials - it's a direct update to this app's own
// Users table (Users.IsActive, already the real mechanism authCore.ts checks at sign-in). Matches
// by email like AgentQA/Teamwork, with an optional username override for the rare case where a
// Staff record's email differs from their LogMonitor login.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'LogMonitorUsername')
    ALTER TABLE Staff ADD LogMonitorUsername NVARCHAR(100) NULL
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OffboardingActions') AND name = 'LogMonitorStatus')
    ALTER TABLE OffboardingActions ADD LogMonitorStatus NVARCHAR(30) NOT NULL DEFAULT 'Skipped'
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OffboardingActions') AND name = 'LogMonitorDetail')
    ALTER TABLE OffboardingActions ADD LogMonitorDetail NVARCHAR(MAX) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OffboardingActions') AND name = 'LogMonitorCompletedAt')
    ALTER TABLE OffboardingActions ADD LogMonitorCompletedAt DATETIME2 NULL
  `;
  await db.query`
    IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_OffboardingActions_LogMonitorStatus')
    ALTER TABLE OffboardingActions DROP CONSTRAINT CK_OffboardingActions_LogMonitorStatus
  `;
  await db.query`
    ALTER TABLE OffboardingActions ADD CONSTRAINT CK_OffboardingActions_LogMonitorStatus CHECK (LogMonitorStatus IN ('Skipped','Pending','Success','Failed'))
  `;

  console.log("Offboarding module Phase 5 schema ready (LogMonitor columns on Staff/OffboardingActions).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
