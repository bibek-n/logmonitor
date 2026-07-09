import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SystemHealthLogs' AND xtype='U')
    CREATE TABLE SystemHealthLogs (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY,
      ReceivedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      LogDate VARCHAR(20) NULL,
      LogTime VARCHAR(20) NULL,
      DeviceName NVARCHAR(100) NULL,
      LogComponent NVARCHAR(100) NULL,
      LogSubtype NVARCHAR(100) NULL,
      Fields NVARCHAR(MAX) NULL,
      RawMessage NVARCHAR(MAX) NULL
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SystemHealthLogs_Component')
    CREATE INDEX IX_SystemHealthLogs_Component ON SystemHealthLogs (LogComponent, ReceivedAt DESC)
  `;

  console.log("SystemHealthLogs table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
