import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CompanySettings' AND xtype='U')
    CREATE TABLE CompanySettings (
      Id INT NOT NULL PRIMARY KEY,
      CompanyName NVARCHAR(200) NULL,
      LogoPath NVARCHAR(500) NULL,
      WebsiteUrl NVARCHAR(500) NULL,
      Industry NVARCHAR(100) NULL,
      CompanySize NVARCHAR(50) NULL,
      AddressLine1 NVARCHAR(300) NULL,
      AddressLine2 NVARCHAR(300) NULL,
      City NVARCHAR(100) NULL,
      State NVARCHAR(100) NULL,
      PostalCode NVARCHAR(30) NULL,
      Country NVARCHAR(100) NULL,
      ContactEmail NVARCHAR(200) NULL,
      ContactPhone NVARCHAR(50) NULL,
      PrimaryColor VARCHAR(20) NULL,
      SecondaryColor VARCHAR(20) NULL,
      FaviconPath NVARCHAR(500) NULL,
      LoginBrandingEnabled BIT NOT NULL DEFAULT 0,
      LoginTagline NVARCHAR(300) NULL,
      FooterText NVARCHAR(MAX) NULL,
      DefaultTimezone NVARCHAR(100) NULL,
      DefaultLanguage NVARCHAR(20) NULL,
      DateFormat NVARCHAR(30) NULL,
      TimeFormat NVARCHAR(30) NULL,
      MaintenanceModeEnabled BIT NOT NULL DEFAULT 0,
      MaintenanceMessage NVARCHAR(MAX) NULL,
      RetentionPolicyDays INT NULL,
      RetentionPolicyNotes NVARCHAR(MAX) NULL,
      BackupScheduleEnabled BIT NOT NULL DEFAULT 0,
      BackupScheduleFrequency NVARCHAR(20) NULL,
      BackupScheduleTime NVARCHAR(10) NULL,
      BackupRetentionCount INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL
    )
  `;

  const existing = await db.query`SELECT COUNT(*) AS Cnt FROM CompanySettings WHERE Id = 1`;
  if (existing.recordset[0].Cnt === 0) {
    await db.query`
      INSERT INTO CompanySettings (Id, CompanyName, DefaultTimezone, DefaultLanguage, DateFormat, TimeFormat, PrimaryColor, SecondaryColor)
      VALUES (1, 'Tulips Unified Admin Center', 'UTC', 'en', 'YYYY-MM-DD', '24h', '#00C2FF', '#00B8A9')
    `;
    console.log("Seeded default CompanySettings row.");
  }

  console.log("CompanySettings table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
