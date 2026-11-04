import "dotenv/config";
import { getDb } from "../src/lib/db";

// Employee Offboarding module: GitLab (block user) + Glesys Email (credential-reset fallback,
// since Glesys's documented API has no dedicated mailbox-disable endpoint - see
// src/lib/offboarding/glesysClient.ts). Adds mapping columns to the existing Staff table
// (reused, not a separate employee directory - Staff already has Name/Email/Department) plus
// two new tables: one row per "Disable All" execution (OffboardingActions, re-used on retry so
// repeated clicks stay idempotent) and a singleton settings row for the encrypted GitLab/Glesys
// admin credentials (OffboardingSettings).
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'GitLabUsername')
    ALTER TABLE Staff ADD GitLabUsername NVARCHAR(255) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'GitLabUserId')
    ALTER TABLE Staff ADD GitLabUserId INT NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'GlesysMailbox')
    ALTER TABLE Staff ADD GlesysMailbox NVARCHAR(255) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'OffboardingDate')
    ALTER TABLE Staff ADD OffboardingDate DATE NULL
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OffboardingActions' AND xtype='U')
    CREATE TABLE OffboardingActions (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      StaffId INT NOT NULL,
      InitiatedByUserId INT NOT NULL,
      InitiatedByUsername NVARCHAR(100) NOT NULL,
      GitLabStatus NVARCHAR(30) NOT NULL DEFAULT 'Skipped',
      GitLabDetail NVARCHAR(MAX) NULL,
      GitLabCompletedAt DATETIME2 NULL,
      GlesysStatus NVARCHAR(30) NOT NULL DEFAULT 'Skipped',
      GlesysDetail NVARCHAR(MAX) NULL,
      GlesysNewPasswordEncrypted NVARCHAR(MAX) NULL,
      GlesysCompletedAt DATETIME2 NULL,
      OverallStatus NVARCHAR(30) NOT NULL DEFAULT 'Pending',
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_OffboardingActions_Staff FOREIGN KEY (StaffId) REFERENCES Staff(Id),
      CONSTRAINT CK_OffboardingActions_GitLabStatus CHECK (GitLabStatus IN ('Skipped','Pending','Success','Failed')),
      CONSTRAINT CK_OffboardingActions_GlesysStatus CHECK (GlesysStatus IN ('Skipped','Pending','Success','Failed','ManualActionRequired')),
      CONSTRAINT CK_OffboardingActions_OverallStatus CHECK (OverallStatus IN ('Pending','Complete','PartiallyComplete','Failed'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_OffboardingActions_StaffId')
    CREATE INDEX IX_OffboardingActions_StaffId ON OffboardingActions(StaffId, CreatedAt DESC)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OffboardingSettings' AND xtype='U')
    CREATE TABLE OffboardingSettings (
      Id INT NOT NULL PRIMARY KEY,
      GitLabBaseUrl NVARCHAR(500) NULL,
      GitLabEncryptedToken NVARCHAR(MAX) NULL,
      GlesysApiUser NVARCHAR(200) NULL,
      GlesysEncryptedApiKey NVARCHAR(MAX) NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM OffboardingSettings WHERE Id = 1)
    INSERT INTO OffboardingSettings (Id) VALUES (1)
  `;

  console.log("Offboarding module schema ready (Staff mapping columns, OffboardingActions, OffboardingSettings).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
