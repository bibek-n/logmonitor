import "dotenv/config";
import { getDb } from "../src/lib/db";
import type { ConnectionPool } from "mssql";

async function addColumnIfMissing(db: ConnectionPool, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "Websites", "Enabled", "BIT NOT NULL DEFAULT 1");

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WebsiteAuditSourceInputs' AND xtype='U')
    CREATE TABLE WebsiteAuditSourceInputs (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      WebsiteId INT NOT NULL UNIQUE,
      Ecosystem NVARCHAR(30) NULL,
      LockfileFilename NVARCHAR(200) NULL,
      LockfileContent NVARCHAR(MAX) NULL,
      SourceSnippet NVARCHAR(MAX) NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_WebsiteAuditSourceInputs_Websites FOREIGN KEY (WebsiteId) REFERENCES Websites(Id) ON DELETE CASCADE
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WebsiteAuditScans' AND xtype='U')
    CREATE TABLE WebsiteAuditScans (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      WebsiteId INT NOT NULL,
      ScanDate DATE NOT NULL,
      StartedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CompletedAt DATETIME2 NULL,
      Status NVARCHAR(20) NOT NULL DEFAULT 'Pending',
      SecurityScore INT NULL,
      RiskLevel NVARCHAR(20) NULL,
      DetectedPlatform NVARCHAR(100) NULL,
      TriggeredByUserId INT NULL,
      TriggeredBy NVARCHAR(50) NOT NULL DEFAULT 'admin',
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_WebsiteAuditScans_Websites FOREIGN KEY (WebsiteId) REFERENCES Websites(Id) ON DELETE CASCADE,
      CONSTRAINT UQ_WebsiteAuditScans_Website_Date UNIQUE (WebsiteId, ScanDate)
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WebsiteAuditFindings' AND xtype='U')
    CREATE TABLE WebsiteAuditFindings (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ScanId INT NOT NULL,
      Category NVARCHAR(50) NOT NULL,
      Severity NVARCHAR(20) NOT NULL,
      Title NVARCHAR(300) NOT NULL,
      Description NVARCHAR(MAX) NULL,
      Evidence NVARCHAR(MAX) NULL,
      Recommendation NVARCHAR(MAX) NULL,
      CONSTRAINT FK_WebsiteAuditFindings_Scans FOREIGN KEY (ScanId) REFERENCES WebsiteAuditScans(Id) ON DELETE CASCADE
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WebsiteDependencyFindings' AND xtype='U')
    CREATE TABLE WebsiteDependencyFindings (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ScanId INT NOT NULL,
      PackageName NVARCHAR(200) NOT NULL,
      CurrentVersion NVARCHAR(50) NULL,
      RecommendedVersion NVARCHAR(50) NULL,
      Ecosystem NVARCHAR(30) NOT NULL,
      Severity NVARCHAR(20) NOT NULL,
      CveIds NVARCHAR(500) NULL,
      Reason NVARCHAR(100) NOT NULL,
      CONSTRAINT FK_WebsiteDependencyFindings_Scans FOREIGN KEY (ScanId) REFERENCES WebsiteAuditScans(Id) ON DELETE CASCADE
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WebsiteCodeFindings' AND xtype='U')
    CREATE TABLE WebsiteCodeFindings (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ScanId INT NOT NULL,
      Category NVARCHAR(50) NOT NULL,
      Severity NVARCHAR(20) NOT NULL,
      Location NVARCHAR(300) NULL,
      MaskedEvidence NVARCHAR(500) NULL,
      Recommendation NVARCHAR(MAX) NULL,
      CONSTRAINT FK_WebsiteCodeFindings_Scans FOREIGN KEY (ScanId) REFERENCES WebsiteAuditScans(Id) ON DELETE CASCADE
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WebsiteAuditReports' AND xtype='U')
    CREATE TABLE WebsiteAuditReports (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ScanId INT NOT NULL UNIQUE,
      PdfPath NVARCHAR(500) NOT NULL,
      GeneratedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_WebsiteAuditReports_Scans FOREIGN KEY (ScanId) REFERENCES WebsiteAuditScans(Id) ON DELETE CASCADE
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WebsiteAuditEmailLogs' AND xtype='U')
    CREATE TABLE WebsiteAuditEmailLogs (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ScanId INT NOT NULL,
      ToAddress NVARCHAR(320) NOT NULL,
      Subject NVARCHAR(300) NOT NULL,
      Success BIT NOT NULL,
      ErrorMessage NVARCHAR(MAX) NULL,
      SentAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_WebsiteAuditEmailLogs_Scans FOREIGN KEY (ScanId) REFERENCES WebsiteAuditScans(Id) ON DELETE CASCADE
    )
  `;

  // WebsiteId/ScanId here are deliberately plain columns, no FK — this is an activity trail
  // that should survive even after its website/scan is later removed or purged (the 7-day
  // retention job deletes WebsiteAuditScans rows, which would cascade-delete this table's
  // rows too if it had a FK to Scans). Same "allowed to orphan" reasoning already used by
  // EnrollmentTokens.UsedByDeviceId elsewhere in this schema.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WebsiteAuditActivityLogs' AND xtype='U')
    CREATE TABLE WebsiteAuditActivityLogs (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      WebsiteId INT NULL,
      ScanId INT NULL,
      Action NVARCHAR(100) NOT NULL,
      Details NVARCHAR(MAX) NULL,
      ActorUserId INT NULL,
      ActorName NVARCHAR(50) NOT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  console.log("Website Security Audit tables ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
