import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityHeaderScans' AND xtype='U')
    CREATE TABLE SecurityHeaderScans (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      WebsiteId INT NULL,
      TargetUrl NVARCHAR(1000) NOT NULL,
      FinalUrl NVARCHAR(1000) NULL,
      IpAddress VARCHAR(45) NULL,
      StatusCode INT NULL,
      Grade VARCHAR(5) NOT NULL,
      Score INT NOT NULL,
      HeadersJson NVARCHAR(MAX) NOT NULL,
      MissingHeadersJson NVARCHAR(MAX) NOT NULL,
      PresentHeadersJson NVARCHAR(MAX) NOT NULL,
      ErrorMessage NVARCHAR(1000) NULL,
      TriggeredByUserId INT NULL,
      TriggeredByUsername NVARCHAR(100) NULL,
      ScannedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_SecurityHeaderScans_Websites FOREIGN KEY (WebsiteId) REFERENCES Websites(Id) ON DELETE SET NULL
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SecurityHeaderScans_ScannedAt')
    CREATE INDEX IX_SecurityHeaderScans_ScannedAt ON SecurityHeaderScans (ScannedAt DESC)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SecurityHeaderScans_WebsiteId')
    CREATE INDEX IX_SecurityHeaderScans_WebsiteId ON SecurityHeaderScans (WebsiteId)
  `;

  console.log("SecurityHeaderScans table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
