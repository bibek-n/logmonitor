import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RouterLogs' AND xtype='U')
    CREATE TABLE RouterLogs (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY,
      ReceivedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      DeviceTimestamp DATETIME2 NULL,
      Hostname NVARCHAR(100) NULL,
      Facility NVARCHAR(30) NULL,
      Severity NVARCHAR(30) NULL,
      Message NVARCHAR(2000) NULL,
      RawMessage NVARCHAR(MAX) NULL
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_RouterLogs_ReceivedAt')
    CREATE INDEX IX_RouterLogs_ReceivedAt ON RouterLogs (ReceivedAt DESC)
  `;

  console.log("RouterLogs table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
