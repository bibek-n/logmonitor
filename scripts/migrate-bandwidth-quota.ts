import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();
  await db.query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'BandwidthQuotaSettings')
    BEGIN
      CREATE TABLE BandwidthQuotaSettings (
        Id INT PRIMARY KEY CHECK (Id = 1),
        DailyCapGb FLOAT NULL,
        Enabled BIT NOT NULL DEFAULT 0,
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedByUserId INT NULL
      )
    END
  `);
  await db.query(`
    IF NOT EXISTS (SELECT 1 FROM BandwidthQuotaSettings WHERE Id = 1)
    BEGIN
      INSERT INTO BandwidthQuotaSettings (Id, DailyCapGb, Enabled) VALUES (1, 10, 0)
    END
  `);
  console.log("BandwidthQuotaSettings table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
