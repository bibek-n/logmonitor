import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  // A website with no row here uses the existing default behavior (once daily, ~02:00,
  // unchanged) — a row only exists once an admin sets a custom schedule for that website,
  // and that custom schedule always takes priority over the default.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WebsiteScanSchedules' AND xtype='U')
    CREATE TABLE WebsiteScanSchedules (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      WebsiteId INT NOT NULL,
      ScheduleType NVARCHAR(20) NOT NULL,
      TimesPerDay INT NOT NULL DEFAULT 1,
      ScanTimes NVARCHAR(100) NOT NULL DEFAULT '02:00',
      RepeatIntervalDays INT NULL,
      DayOfWeek INT NULL,
      DayOfMonth INT NULL,
      MonthOfYear INT NULL,
      LastRunAt DATETIME2 NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_WebsiteScanSchedules_Websites FOREIGN KEY (WebsiteId) REFERENCES Websites(Id) ON DELETE CASCADE,
      CONSTRAINT UQ_WebsiteScanSchedules_WebsiteId UNIQUE (WebsiteId)
    )
  `;

  console.log("Website scan schedule table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
