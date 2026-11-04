import "dotenv/config";
import { getDb } from "../src/lib/db";

// Per-website recurring WordPress deep scans, mirroring the claim-and-advance pattern already
// used for Security & Updates (UpdateSchedules / runDueSchedules in src/lib/securityUpdates/
// installs.ts). One schedule per website (UNIQUE WebsiteId) — enabling/editing a site's
// schedule is an upsert against that one row, not a growing list of schedule rows per site.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WordPressScanSchedules' AND xtype='U')
    CREATE TABLE WordPressScanSchedules (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      WebsiteId INT NOT NULL,
      Recurrence VARCHAR(20) NOT NULL,
      Profile VARCHAR(20) NOT NULL DEFAULT 'standard',
      NextRunAt DATETIME2 NOT NULL,
      LastRunAt DATETIME2 NULL,
      IsActive BIT NOT NULL DEFAULT 1,
      CreatedByUserId INT NULL,
      CreatedByUsername NVARCHAR(100) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_WordPressScanSchedules_Website FOREIGN KEY (WebsiteId) REFERENCES Websites(Id) ON DELETE CASCADE,
      CONSTRAINT CK_WordPressScanSchedules_Recurrence CHECK (Recurrence IN ('daily','weekly','monthly')),
      CONSTRAINT CK_WordPressScanSchedules_Profile CHECK (Profile IN ('quick','standard','comprehensive')),
      CONSTRAINT UQ_WordPressScanSchedules_Website UNIQUE (WebsiteId)
    )
  `;
  await db.query`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_WordPressScanSchedules_NextRunAt') CREATE INDEX IX_WordPressScanSchedules_NextRunAt ON WordPressScanSchedules (NextRunAt)`;

  console.log("WordPressScanSchedules table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
