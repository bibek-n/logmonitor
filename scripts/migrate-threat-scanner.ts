import "dotenv/config";
import { getDb } from "../src/lib/db";

// VirusTotal-backed threat scanner: File/URL scans are async (VT's own multi-engine analysis
// takes anywhere from a few seconds to a couple minutes), Hash/IP/Domain lookups are
// synchronous reads of VT's existing report for that resource. One table covers all five
// kinds rather than five near-identical tables, since the row shape (target, status, verdict
// counts, raw per-engine JSON) is the same regardless of kind.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ThreatScans' AND xtype='U')
    CREATE TABLE ThreatScans (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Kind VARCHAR(10) NOT NULL,
      Target NVARCHAR(1000) NOT NULL,
      WebsiteId INT NULL,
      VtAnalysisId NVARCHAR(300) NULL,
      VtResourceId NVARCHAR(300) NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'Pending',
      Verdict VARCHAR(20) NULL,
      MaliciousCount INT NULL,
      SuspiciousCount INT NULL,
      HarmlessCount INT NULL,
      UndetectedCount INT NULL,
      TimeoutCount INT NULL,
      EngineCount INT NULL,
      ResultJson NVARCHAR(MAX) NULL,
      ErrorMessage NVARCHAR(1000) NULL,
      OriginalFileName NVARCHAR(500) NULL,
      ContentType NVARCHAR(200) NULL,
      SizeBytes BIGINT NULL,
      FilePath NVARCHAR(500) NULL,
      TriggeredByUserId INT NULL,
      TriggeredByUsername NVARCHAR(100) NULL,
      StartedAt DATETIME2 NULL,
      CompletedAt DATETIME2 NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_ThreatScans_Websites FOREIGN KEY (WebsiteId) REFERENCES Websites(Id) ON DELETE SET NULL,
      CONSTRAINT CK_ThreatScans_Kind CHECK (Kind IN ('File', 'Url', 'Hash', 'Ip', 'Domain')),
      CONSTRAINT CK_ThreatScans_Status CHECK (Status IN ('Pending', 'Running', 'Completed', 'Failed', 'NotFound'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_ThreatScans_CreatedAt')
    CREATE INDEX IX_ThreatScans_CreatedAt ON ThreatScans (CreatedAt DESC)
  `;

  console.log("ThreatScans table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
