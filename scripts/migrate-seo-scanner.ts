import "dotenv/config";
import { getDb } from "../src/lib/db";

// SEO Scanner - single wide table with JSON blob columns, same shape as WordPressDeepScans
// (append-only, one row per scan, no separate findings child table) since these checks are
// re-evaluated fresh each run rather than tracked as dismissible findings over time.
// WebsiteId references the same shared Websites table every other scanner module reads from
// (Security Headers, WordPress Scan, Malware Detection) - "take all sites from the Website
// submenu" means this table's only site source, never a separate site-registration table.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SeoScans' AND xtype='U')
    CREATE TABLE SeoScans (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      WebsiteId INT NULL,
      TargetUrl NVARCHAR(1000) NOT NULL,
      Score INT NOT NULL,
      Grade VARCHAR(5) NOT NULL,
      FindingsJson NVARCHAR(MAX) NOT NULL,
      ChecksJson NVARCHAR(MAX) NOT NULL,
      TriggeredByUserId INT NULL,
      TriggeredByUsername NVARCHAR(100) NULL,
      ScannedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_SeoScans_Websites FOREIGN KEY (WebsiteId) REFERENCES Websites(Id) ON DELETE SET NULL
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SeoScans_ScannedAt')
    CREATE INDEX IX_SeoScans_ScannedAt ON SeoScans (ScannedAt DESC)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SeoScans_WebsiteId')
    CREATE INDEX IX_SeoScans_WebsiteId ON SeoScans (WebsiteId)
  `;

  console.log("SeoScans table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
