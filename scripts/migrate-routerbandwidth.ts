import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RouterBandwidth' AND xtype='U')
    CREATE TABLE RouterBandwidth (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY,
      ReceivedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      Interface NVARCHAR(50) NOT NULL,
      RxMbps DECIMAL(10,3) NULL,
      TxMbps DECIMAL(10,3) NULL
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_RouterBandwidth_Interface')
    CREATE INDEX IX_RouterBandwidth_Interface ON RouterBandwidth (Interface, ReceivedAt DESC)
  `;

  console.log("RouterBandwidth table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
