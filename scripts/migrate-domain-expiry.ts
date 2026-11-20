import "dotenv/config";
import { getDb } from "../src/lib/db";

// Mirrors SslCertificateRecords' shape exactly (one row per monitor, LastCheckedAt +
// LastAlertThresholdDays for the same crossing-dedup pattern via evaluateSslExpiry(), reused
// as-is for domain expiry in scripts/run-website-api-monitoring-scan.ts).
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DomainExpiryRecords' AND xtype='U')
    CREATE TABLE DomainExpiryRecords (
      MonitorId INT PRIMARY KEY REFERENCES Monitors(Id) ON DELETE CASCADE,
      Domain NVARCHAR(300) NULL,
      ExpiresAt DATETIME2 NULL,
      LastCheckedAt DATETIME2 NULL,
      LastAlertThresholdDays INT NULL
    )
  `;

  console.log("DomainExpiryRecords table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
