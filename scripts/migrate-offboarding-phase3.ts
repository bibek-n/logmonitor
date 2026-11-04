import "dotenv/config";
import { getDb } from "../src/lib/db";

// Employee Offboarding Phase 3: adds Teamwork (teamwork.websearchpro.net) as a fourth system.
// Built from a single example call (no full doc like AgentQA's), so kept deliberately minimal:
// matches by email only (no documented UUID alternative), Bearer-token auth, and a fresh random
// request_id generated per call (confirmed with the user: no idempotency/dedup meaning on
// Teamwork's side, just a trace id). Disabling is reversible per the user, but no restore
// endpoint was documented either - see teamworkClient.ts.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'TeamworkEmail')
    ALTER TABLE Staff ADD TeamworkEmail NVARCHAR(255) NULL
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OffboardingActions') AND name = 'TeamworkStatus')
    ALTER TABLE OffboardingActions ADD TeamworkStatus NVARCHAR(30) NOT NULL DEFAULT 'Skipped'
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OffboardingActions') AND name = 'TeamworkDetail')
    ALTER TABLE OffboardingActions ADD TeamworkDetail NVARCHAR(MAX) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OffboardingActions') AND name = 'TeamworkCompletedAt')
    ALTER TABLE OffboardingActions ADD TeamworkCompletedAt DATETIME2 NULL
  `;
  await db.query`
    IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_OffboardingActions_TeamworkStatus')
    ALTER TABLE OffboardingActions DROP CONSTRAINT CK_OffboardingActions_TeamworkStatus
  `;
  await db.query`
    ALTER TABLE OffboardingActions ADD CONSTRAINT CK_OffboardingActions_TeamworkStatus CHECK (TeamworkStatus IN ('Skipped','Pending','Success','Failed'))
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OffboardingSettings') AND name = 'TeamworkApiUrl')
    ALTER TABLE OffboardingSettings ADD TeamworkApiUrl NVARCHAR(500) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OffboardingSettings') AND name = 'TeamworkEncryptedApiKey')
    ALTER TABLE OffboardingSettings ADD TeamworkEncryptedApiKey NVARCHAR(MAX) NULL
  `;
  await db.query`
    UPDATE OffboardingSettings SET TeamworkApiUrl = 'https://rrseszibigvbwlwocntw.supabase.co/functions/v1/revoke-user-access'
    WHERE Id = 1 AND TeamworkApiUrl IS NULL
  `;

  console.log("Offboarding module Phase 3 schema ready (Teamwork columns on Staff/OffboardingActions/OffboardingSettings).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
