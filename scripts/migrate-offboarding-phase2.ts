import "dotenv/config";
import { getDb } from "../src/lib/db";

// Employee Offboarding Phase 2: adds AgentQA (agentqa.lovable.app, Supabase-backed) as a third
// system alongside GitLab and Glesys. AgentQA's own documented API (POST .../user-access-api,
// x-api-key header, {email|user_id, disabled}) already matches an employee by email, so unlike
// GitLab/Glesys this one needs no mandatory per-employee mapping step - Staff.Email is used by
// default, with AgentQaUserId as an optional override for the rare case where the AgentQA login
// differs from the employee's Staff.Email.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'AgentQaUserId')
    ALTER TABLE Staff ADD AgentQaUserId NVARCHAR(100) NULL
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OffboardingActions') AND name = 'AgentQaStatus')
    ALTER TABLE OffboardingActions ADD AgentQaStatus NVARCHAR(30) NOT NULL DEFAULT 'Skipped'
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OffboardingActions') AND name = 'AgentQaDetail')
    ALTER TABLE OffboardingActions ADD AgentQaDetail NVARCHAR(MAX) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OffboardingActions') AND name = 'AgentQaCompletedAt')
    ALTER TABLE OffboardingActions ADD AgentQaCompletedAt DATETIME2 NULL
  `;
  await db.query`
    IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_OffboardingActions_AgentQaStatus')
    ALTER TABLE OffboardingActions DROP CONSTRAINT CK_OffboardingActions_AgentQaStatus
  `;
  await db.query`
    ALTER TABLE OffboardingActions ADD CONSTRAINT CK_OffboardingActions_AgentQaStatus CHECK (AgentQaStatus IN ('Skipped','Pending','Success','Failed'))
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OffboardingSettings') AND name = 'AgentQaApiUrl')
    ALTER TABLE OffboardingSettings ADD AgentQaApiUrl NVARCHAR(500) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OffboardingSettings') AND name = 'AgentQaEncryptedApiKey')
    ALTER TABLE OffboardingSettings ADD AgentQaEncryptedApiKey NVARCHAR(MAX) NULL
  `;
  // Pre-fill the documented, fixed endpoint URL so the settings page only needs an API key -
  // still editable in case it's ever regenerated under a different project.
  await db.query`
    UPDATE OffboardingSettings SET AgentQaApiUrl = 'https://fwbegywvgywdpgcliqbz.supabase.co/functions/v1/user-access-api'
    WHERE Id = 1 AND AgentQaApiUrl IS NULL
  `;

  console.log("Offboarding module Phase 2 schema ready (AgentQA columns on Staff/OffboardingActions/OffboardingSettings).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
