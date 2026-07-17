import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WordPressDeepScans' AND xtype='U')
    CREATE TABLE WordPressDeepScans (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      WebsiteId INT NULL,
      TargetUrl NVARCHAR(1000) NOT NULL,
      IsWordPress BIT NOT NULL,
      CoreVersion NVARCHAR(50) NULL,
      ThemeSlug NVARCHAR(200) NULL,
      ThemeVersion NVARCHAR(50) NULL,
      RiskLevel VARCHAR(20) NOT NULL,
      FindingsJson NVARCHAR(MAX) NOT NULL,
      ChecksJson NVARCHAR(MAX) NOT NULL,
      PluginsJson NVARCHAR(MAX) NOT NULL,
      TriggeredByUserId INT NULL,
      TriggeredByUsername NVARCHAR(100) NULL,
      ScannedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_WordPressDeepScans_Websites FOREIGN KEY (WebsiteId) REFERENCES Websites(Id) ON DELETE SET NULL
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_WordPressDeepScans_ScannedAt')
    CREATE INDEX IX_WordPressDeepScans_ScannedAt ON WordPressDeepScans (ScannedAt DESC)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_WordPressDeepScans_WebsiteId')
    CREATE INDEX IX_WordPressDeepScans_WebsiteId ON WordPressDeepScans (WebsiteId)
  `;

  console.log("WordPressDeepScans table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
