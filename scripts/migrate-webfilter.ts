import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WebFilterLogs' AND xtype='U')
    CREATE TABLE WebFilterLogs (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY,
      ReceivedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      LogDate VARCHAR(20) NULL,
      LogTime VARCHAR(20) NULL,
      DeviceName NVARCHAR(100) NULL,
      SrcIp VARCHAR(45) NULL,
      DstIp VARCHAR(45) NULL,
      SrcPort INT NULL,
      DstPort INT NULL,
      Protocol VARCHAR(20) NULL,
      HttpMethod VARCHAR(20) NULL,
      Url NVARCHAR(2048) NULL,
      Domain NVARCHAR(500) NULL,
      Category NVARCHAR(200) NULL,
      CategoryType NVARCHAR(100) NULL,
      Action NVARCHAR(50) NULL,
      UserName NVARCHAR(200) NULL,
      LogType NVARCHAR(100) NULL,
      LogComponent NVARCHAR(100) NULL,
      LogSubtype NVARCHAR(100) NULL,
      RawMessage NVARCHAR(MAX) NULL
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WebFilterLogs_SrcIp')
    CREATE INDEX IX_WebFilterLogs_SrcIp ON WebFilterLogs (SrcIp, ReceivedAt DESC)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WebFilterLogs_ReceivedAt')
    CREATE INDEX IX_WebFilterLogs_ReceivedAt ON WebFilterLogs (ReceivedAt DESC)
  `;

  console.log("WebFilterLogs table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
