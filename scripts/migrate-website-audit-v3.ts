import "dotenv/config";
import { getDb } from "../src/lib/db";

// Additive: a per-scan progress log (so the dashboard can show something like a live
// terminal while a manual scan runs) plus support for a genuine 'Failed' scan status —
// previously every scan ended up 'Completed' one way or another (even internal errors were
// swallowed into a "scan_error" finding), which meant a scan that failed outside that
// internal safety net had no way to ever leave 'Running'.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WebsiteAuditScanLog' AND xtype='U')
    CREATE TABLE WebsiteAuditScanLog (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ScanId INT NOT NULL,
      Message NVARCHAR(500) NOT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_WebsiteAuditScanLog_Scans FOREIGN KEY (ScanId) REFERENCES WebsiteAuditScans(Id) ON DELETE CASCADE
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_WebsiteAuditScanLog_ScanId')
    CREATE INDEX IX_WebsiteAuditScanLog_ScanId ON WebsiteAuditScanLog(ScanId, Id)
  `;

  console.log("Website Security Audit v3 (scan progress log) ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
