import "dotenv/config";
import { getDb } from "../src/lib/db";
import type { ConnectionPool } from "mssql";

async function addColumnIfMissing(db: ConnectionPool, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

// Extends the Database Analyzer module (Phase 1: migrate-database-analyzer.ts) with:
//  - .sql file upload as a second connection Source alongside "live" (no network connection
//    at all - a DDL script is parsed into the same SchemaSnapshot shape and run through the
//    same rule engine), so HostName/Port/DatabaseName/Username/PasswordEncrypted all become
//    optional (NULL for an "upload" row)
//  - a separate, admin-configured AI layer (DbAnalyzerAiConfig, singleton row like
//    SmtpSettings) with its own Non-AI/AI/Hybrid mode switch - Non-AI (the Phase 1 behavior)
//    stays the default and requires zero configuration
async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "DbAnalyzerConnections", "Source", "VARCHAR(10) NOT NULL DEFAULT 'live'");
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_DbAnalyzerConnections_Source')
    ALTER TABLE DbAnalyzerConnections ADD CONSTRAINT CK_DbAnalyzerConnections_Source CHECK (Source IN ('live','upload'))
  `);
  await addColumnIfMissing(db, "DbAnalyzerConnections", "UploadedSqlText", "NVARCHAR(MAX) NULL");
  await addColumnIfMissing(db, "DbAnalyzerConnections", "SourceFileName", "NVARCHAR(255) NULL");

  // Existing rows are all "live" connections (the default above backfills them correctly) -
  // the columns below just need to become nullable so an "upload" row can leave them blank.
  const nullableCols: [string, string][] = [
    ["HostName", "NVARCHAR(255)"],
    ["Port", "INT"],
    ["DatabaseName", "NVARCHAR(200)"],
    ["Username", "NVARCHAR(200)"],
    ["PasswordEncrypted", "NVARCHAR(500)"],
  ];
  for (const [col, type] of nullableCols) {
    const info = await db.query(`
      SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'DbAnalyzerConnections' AND COLUMN_NAME = '${col}'
    `);
    if (info.recordset[0]?.IS_NULLABLE === "NO") {
      await db.query(`ALTER TABLE DbAnalyzerConnections ALTER COLUMN ${col} ${type} NULL`);
    }
  }

  await addColumnIfMissing(db, "DbAnalyzerScans", "AnalysisMode", "VARCHAR(10) NULL");
  await addColumnIfMissing(db, "DbAnalyzerScans", "AiSummary", "NVARCHAR(MAX) NULL");
  await addColumnIfMissing(db, "DbAnalyzerScans", "AiError", "NVARCHAR(1000) NULL");
  // Backfill: every scan run before this migration used the rule engine only.
  await db.query(`UPDATE DbAnalyzerScans SET AnalysisMode = 'non_ai' WHERE AnalysisMode IS NULL AND Status = 'Completed'`);

  await addColumnIfMissing(db, "DbAnalyzerFindings", "Source", "VARCHAR(10) NULL");
  await db.query(`UPDATE DbAnalyzerFindings SET Source = 'rule' WHERE Source IS NULL`);

  await db.query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DbAnalyzerAiConfig' AND xtype='U')
    CREATE TABLE DbAnalyzerAiConfig (
      Id INT NOT NULL PRIMARY KEY,
      Provider NVARCHAR(50) NULL,
      BaseUrl NVARCHAR(255) NULL,
      ApiKeyEncrypted NVARCHAR(500) NULL,
      Model NVARCHAR(100) NULL,
      Mode VARCHAR(10) NOT NULL DEFAULT 'non_ai',
      Enabled BIT NOT NULL DEFAULT 0,
      LastTestAt DATETIME2 NULL,
      LastTestSuccess BIT NULL,
      LastTestMessage NVARCHAR(500) NULL,
      UpdatedAt DATETIME2 NULL,
      UpdatedByUserId INT NULL,
      CONSTRAINT CK_DbAnalyzerAiConfig_Mode CHECK (Mode IN ('non_ai','ai','hybrid'))
    )
  `);
  const existing = await db.query(`SELECT COUNT(*) AS Cnt FROM DbAnalyzerAiConfig WHERE Id = 1`);
  if (existing.recordset[0].Cnt === 0) {
    await db.query(`INSERT INTO DbAnalyzerAiConfig (Id, Mode, Enabled) VALUES (1, 'non_ai', 0)`);
  }

  console.log("Database Analyzer v2 schema ready (SQL file upload + AI config/mode switching).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
