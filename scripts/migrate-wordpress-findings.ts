import "dotenv/config";
import { getDb } from "../src/lib/db";

// Persistent, triaged findings for the WordPress Deep Scan tool, mirroring the house pattern
// already used for intrusion-detection alerts (SecurityAlerts.Status + SecurityAlertStatusHistory
// in migrate-intrusion-detection.ts). Each scan's raw FindingsJson blob (WordPressDeepScans)
// stays untouched as a cheap point-in-time snapshot — this table adds a stable, deduplicated,
// per-website identity on top of it so a finding can be tracked/triaged across scans instead
// of reappearing as a brand-new row every time.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WordPressFindings' AND xtype='U')
    CREATE TABLE WordPressFindings (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      WebsiteId INT NOT NULL,
      FindingKey VARCHAR(64) NOT NULL,
      CheckId VARCHAR(40) NOT NULL,
      Severity VARCHAR(20) NOT NULL,
      Title NVARCHAR(500) NOT NULL,
      Detail NVARCHAR(MAX) NULL,
      Evidence NVARCHAR(MAX) NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'Open',
      FirstSeenScanId INT NOT NULL,
      LastSeenScanId INT NOT NULL,
      FirstSeenAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      LastSeenAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      ResolvedAt DATETIME2 NULL,
      CONSTRAINT FK_WordPressFindings_Website FOREIGN KEY (WebsiteId) REFERENCES Websites(Id) ON DELETE CASCADE,
      CONSTRAINT CK_WordPressFindings_Status CHECK (Status IN ('Open','InProgress','Resolved','AcceptedRisk','FalsePositive')),
      CONSTRAINT UQ_WordPressFindings_Website_Key UNIQUE (WebsiteId, FindingKey)
    )
  `;
  await db.query`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_WordPressFindings_WebsiteId') CREATE INDEX IX_WordPressFindings_WebsiteId ON WordPressFindings (WebsiteId)`;
  await db.query`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_WordPressFindings_Status') CREATE INDEX IX_WordPressFindings_Status ON WordPressFindings (Status)`;
  await db.query`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_WordPressFindings_Severity') CREATE INDEX IX_WordPressFindings_Severity ON WordPressFindings (Severity)`;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WordPressFindingStatusHistory' AND xtype='U')
    CREATE TABLE WordPressFindingStatusHistory (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      FindingId INT NOT NULL,
      OldStatus VARCHAR(20) NULL,
      NewStatus VARCHAR(20) NOT NULL,
      ChangedByUserId INT NULL,
      ChangedByUsername NVARCHAR(100) NULL,
      Reason NVARCHAR(500) NULL,
      ChangedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_WordPressFindingStatusHistory_Finding FOREIGN KEY (FindingId) REFERENCES WordPressFindings(Id) ON DELETE CASCADE
    )
  `;
  await db.query`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_WordPressFindingStatusHistory_FindingId') CREATE INDEX IX_WordPressFindingStatusHistory_FindingId ON WordPressFindingStatusHistory (FindingId)`;

  console.log("WordPressFindings / WordPressFindingStatusHistory tables ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
