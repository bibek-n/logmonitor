import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SpeedTestResults' AND xtype='U')
    CREATE TABLE SpeedTestResults (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Category NVARCHAR(20) NOT NULL,
      Target NVARCHAR(500) NOT NULL,
      PingMs DECIMAL(10,2) NULL,
      DownloadMbps DECIMAL(10,2) NULL,
      UploadMbps DECIMAL(10,2) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  console.log("SpeedTestResults table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
