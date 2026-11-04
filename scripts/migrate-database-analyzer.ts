import "dotenv/config";
import { getDb } from "../src/lib/db";

// Database Intelligence & Security Analyzer - Phase 1 (non-AI core): connection manager +
// structure/security/sensitive-data rule checks. Password reuses the same encryption helper
// (NEXTAUTH_SECRET-derived AES-256-GCM) already used by SqlServerInstances, so no new secret
// management scheme is introduced.
async function main() {
  const db = await getDb();

  await db.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DbAnalyzerConnections' AND xtype='U')
    CREATE TABLE DbAnalyzerConnections (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(200) NOT NULL,
      Engine VARCHAR(20) NOT NULL,
      HostName NVARCHAR(255) NOT NULL,
      Port INT NOT NULL,
      DatabaseName NVARCHAR(200) NOT NULL,
      Username NVARCHAR(200) NOT NULL,
      PasswordEncrypted NVARCHAR(500) NOT NULL,
      Enabled BIT NOT NULL DEFAULT 1,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CreatedByUserId INT NULL,
      CONSTRAINT CK_DbAnalyzerConnections_Engine CHECK (Engine IN ('mssql','mysql','postgres'))
    )
  `);

  await db.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DbAnalyzerScans' AND xtype='U')
    CREATE TABLE DbAnalyzerScans (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ConnectionId INT NOT NULL REFERENCES DbAnalyzerConnections(Id) ON DELETE CASCADE,
      Status VARCHAR(20) NOT NULL,
      StartedAt DATETIME2 NOT NULL,
      CompletedAt DATETIME2 NULL,
      TriggeredByUserId INT NULL,
      TriggeredBy NVARCHAR(200) NULL,
      TableCount INT NULL,
      FindingCount INT NULL,
      SecurityScore INT NULL,
      RiskLevel VARCHAR(20) NULL,
      ServerVersion NVARCHAR(500) NULL,
      SchemaJson NVARCHAR(MAX) NULL,
      ErrorMessage NVARCHAR(1000) NULL,
      CONSTRAINT CK_DbAnalyzerScans_Status CHECK (Status IN ('Running','Completed','Failed'))
    )
  `);

  await db.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DbAnalyzerFindings' AND xtype='U')
    CREATE TABLE DbAnalyzerFindings (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ScanId INT NOT NULL REFERENCES DbAnalyzerScans(Id) ON DELETE CASCADE,
      ConnectionId INT NOT NULL,
      Category VARCHAR(20) NOT NULL,
      Severity VARCHAR(10) NOT NULL,
      Title NVARCHAR(500) NOT NULL,
      Detail NVARCHAR(MAX) NULL,
      Evidence NVARCHAR(MAX) NULL,
      AffectedObject NVARCHAR(500) NULL,
      Recommendation NVARCHAR(1000) NULL,
      CONSTRAINT CK_DbAnalyzerFindings_Category CHECK (Category IN ('structure','security','sensitive-data')),
      CONSTRAINT CK_DbAnalyzerFindings_Severity CHECK (Severity IN ('critical','high','medium','low','info'))
    )
  `);

  console.log("Database Analyzer tables ready.");
  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
