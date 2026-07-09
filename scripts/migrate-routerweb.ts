import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RouterWebLogs' AND xtype='U')
    CREATE TABLE RouterWebLogs (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY,
      ReceivedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      DeviceTimestamp DATETIME2 NULL,
      SrcIp VARCHAR(45) NULL,
      SrcPort INT NULL,
      SrcMac VARCHAR(20) NULL,
      DstIp VARCHAR(45) NULL,
      DstPort INT NULL,
      Protocol VARCHAR(20) NULL,
      ReverseDns NVARCHAR(255) NULL,
      RawMessage NVARCHAR(MAX) NULL
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_RouterWebLogs_SrcIp')
    CREATE INDEX IX_RouterWebLogs_SrcIp ON RouterWebLogs (SrcIp, ReceivedAt DESC)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_RouterWebLogs_ReceivedAt')
    CREATE INDEX IX_RouterWebLogs_ReceivedAt ON RouterWebLogs (ReceivedAt DESC)
  `;

  console.log("RouterWebLogs table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
