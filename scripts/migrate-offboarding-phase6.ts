import "dotenv/config";
import { getDb } from "../src/lib/db";

// Employee Offboarding Phase 6: adds on-prem Active Directory (192.168.1.3, domain TulipsTech.com)
// as a sixth system. AdServer/AdBaseDn are NOT duplicated here - they're already correctly
// configured as AD_SERVER/AD_BASE_DN env vars for the existing AD Sync feature
// (activeDirectorySync.ts) and this reuses them. Only the new write-capable bind credential
// (a dedicated least-privilege account, separate from AD Sync's read-only svc-logmonitor) is
// stored here, encrypted like every other system's credential in this module.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OffboardingSettings') AND name = 'AdBindDn')
    ALTER TABLE OffboardingSettings ADD AdBindDn NVARCHAR(500) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OffboardingSettings') AND name = 'AdEncryptedBindPassword')
    ALTER TABLE OffboardingSettings ADD AdEncryptedBindPassword NVARCHAR(MAX) NULL
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'AdUsername')
    ALTER TABLE Staff ADD AdUsername NVARCHAR(100) NULL
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OffboardingActions') AND name = 'ActiveDirectoryStatus')
    ALTER TABLE OffboardingActions ADD ActiveDirectoryStatus NVARCHAR(30) NOT NULL DEFAULT 'Skipped'
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OffboardingActions') AND name = 'ActiveDirectoryDetail')
    ALTER TABLE OffboardingActions ADD ActiveDirectoryDetail NVARCHAR(MAX) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OffboardingActions') AND name = 'ActiveDirectoryCompletedAt')
    ALTER TABLE OffboardingActions ADD ActiveDirectoryCompletedAt DATETIME2 NULL
  `;
  await db.query`
    IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_OffboardingActions_ActiveDirectoryStatus')
    ALTER TABLE OffboardingActions DROP CONSTRAINT CK_OffboardingActions_ActiveDirectoryStatus
  `;
  await db.query`
    ALTER TABLE OffboardingActions ADD CONSTRAINT CK_OffboardingActions_ActiveDirectoryStatus CHECK (ActiveDirectoryStatus IN ('Skipped','Pending','Success','Failed'))
  `;

  console.log("Offboarding module Phase 6 schema ready (Active Directory columns on OffboardingSettings/Staff/OffboardingActions).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
