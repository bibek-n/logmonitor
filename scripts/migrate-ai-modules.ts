import "dotenv/config";
import { getDb } from "../src/lib/db";

// Shared audit trail for all 6 AI Modules (Root Cause Analysis, Alert Correlation, AI Incident
// Summary, AI Log Analyzer, AI Configuration Review, AI Threat Detection) - one table with a
// ModuleKey column rather than 6 near-identical per-module tables (each module is otherwise the
// exact same shape as AiAssistantQueries: one row per question, no chat-thread/session concept).
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AiModuleQueries' AND xtype='U')
    CREATE TABLE AiModuleQueries (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ModuleKey NVARCHAR(50) NOT NULL,
      UserId INT NOT NULL,
      Username NVARCHAR(100) NOT NULL,
      Question NVARCHAR(2000) NOT NULL,
      Answer NVARCHAR(MAX) NULL,
      ToolsUsedJson NVARCHAR(MAX) NULL,
      ErrorMessage NVARCHAR(500) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_AiModuleQueries_ModuleKey_CreatedAt')
    CREATE INDEX IX_AiModuleQueries_ModuleKey_CreatedAt ON AiModuleQueries (ModuleKey, CreatedAt DESC)
  `;

  console.log("AI Modules schema ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
