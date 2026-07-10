import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BackupHistory' AND xtype='U')
    CREATE TABLE BackupHistory (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      FileName NVARCHAR(300) NOT NULL,
      FilePath NVARCHAR(500) NOT NULL,
      SizeBytes BIGINT NULL,
      Status VARCHAR(20) NOT NULL,
      ErrorMessage NVARCHAR(1000) NULL,
      TriggeredByUserId INT NULL,
      TriggeredByUsername NVARCHAR(100) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_BackupHistory_CreatedAt')
    CREATE INDEX IX_BackupHistory_CreatedAt ON BackupHistory (CreatedAt DESC)
  `;

  console.log("BackupHistory table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
