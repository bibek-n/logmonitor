import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  // Sophos "Events" log type covers Admin/Authentication/System sub-categories
  // (LogComponent) — previously received by the syslog listener and silently dropped.
  // Fields is a JSON blob of whatever key=value pairs Sophos sent, same flexible
  // pattern already used by SystemHealthLogs, since the exact field set varies by
  // LogComponent/LogSubtype.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SophosEventLogs' AND xtype='U')
    CREATE TABLE SophosEventLogs (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ReceivedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      LogDate VARCHAR(20) NULL,
      LogTime VARCHAR(20) NULL,
      DeviceName NVARCHAR(200) NULL,
      LogComponent NVARCHAR(50) NULL,
      LogSubtype NVARCHAR(100) NULL,
      Fields NVARCHAR(MAX) NULL,
      RawMessage NVARCHAR(MAX) NULL
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SophosEventLogs_ReceivedAt')
    CREATE INDEX IX_SophosEventLogs_ReceivedAt ON SophosEventLogs (ReceivedAt DESC)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SophosEventLogs_LogComponent')
    CREATE INDEX IX_SophosEventLogs_LogComponent ON SophosEventLogs (LogComponent, ReceivedAt DESC)
  `;

  console.log("SophosEventLogs table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
