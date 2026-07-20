import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  // Everything the syslog listener previously dropped (Firewall, IPS, Anti-Virus, ATP,
  // etc. - see syslog/listener.ts) - a catch-all with a flexible Fields JSON blob, same
  // shape as SystemHealthLogs/SophosEventLogs, since the exact field set varies by
  // LogType/LogComponent and isn't fully known ahead of time.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SophosThreatLogs' AND xtype='U')
    CREATE TABLE SophosThreatLogs (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY,
      ReceivedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      LogDate VARCHAR(20) NULL,
      LogTime VARCHAR(20) NULL,
      DeviceName NVARCHAR(200) NULL,
      LogType NVARCHAR(100) NULL,
      LogComponent NVARCHAR(100) NULL,
      LogSubtype NVARCHAR(100) NULL,
      SrcIp VARCHAR(45) NULL,
      DstIp VARCHAR(45) NULL,
      Severity NVARCHAR(50) NULL,
      Status NVARCHAR(50) NULL,
      Fields NVARCHAR(MAX) NULL,
      RawMessage NVARCHAR(MAX) NULL
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SophosThreatLogs_ReceivedAt')
    CREATE INDEX IX_SophosThreatLogs_ReceivedAt ON SophosThreatLogs (ReceivedAt DESC)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SophosThreatLogs_LogType')
    CREATE INDEX IX_SophosThreatLogs_LogType ON SophosThreatLogs (LogType, ReceivedAt DESC)
  `;

  console.log("SophosThreatLogs table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
