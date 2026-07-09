import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RouterHealth' AND xtype='U')
    CREATE TABLE RouterHealth (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ReceivedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UptimeSeconds BIGINT NULL,
      Version NVARCHAR(50) NULL,
      BoardName NVARCHAR(100) NULL,
      CpuLoadPct FLOAT NULL,
      CpuCount INT NULL,
      CpuFrequencyMhz FLOAT NULL,
      FreeMemoryMB FLOAT NULL,
      TotalMemoryMB FLOAT NULL,
      FreeDiskMB FLOAT NULL,
      TotalDiskMB FLOAT NULL,
      Temperature FLOAT NULL,
      Voltage FLOAT NULL
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_RouterHealth_ReceivedAt')
    CREATE INDEX IX_RouterHealth_ReceivedAt ON RouterHealth (ReceivedAt DESC)
  `;

  console.log("RouterHealth table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
