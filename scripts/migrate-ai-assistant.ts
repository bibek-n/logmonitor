import "dotenv/config";
import { getDb } from "../src/lib/db";

// AI Assistant conversation history - one row per question, kept as a simple audit trail
// (same reasoning as AdminAuditLog elsewhere in this app) rather than a chat-thread/session
// concept, since each question is answered independently against fresh tool-call data, not a
// continuing conversation with memory of prior turns.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AiAssistantQueries' AND xtype='U')
    CREATE TABLE AiAssistantQueries (
      Id INT IDENTITY(1,1) PRIMARY KEY,
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
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_AiAssistantQueries_UserId_CreatedAt')
    CREATE INDEX IX_AiAssistantQueries_UserId_CreatedAt ON AiAssistantQueries (UserId, CreatedAt DESC)
  `;

  console.log("AI Assistant schema ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
