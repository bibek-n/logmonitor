import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

// Browser Activity Audit module - see the approved plan for full context. Key decisions
// baked into this schema:
//
// - Devices.BrowserActivityIntervalMinutes mirrors Devices.ScreenshotIntervalMinutes exactly
//   (NULL = collector off). Every existing device gets NULL from this migration, so no
//   already-enrolled device starts collecting just because the agent binary was updated -
//   collection only begins after an admin explicitly sets an interval per device.
// - No new employee table - Devices.StaffId (existing FK) is the join for the employee
//   dimension, matching every other agent-driven module in this app.
// - No new audit table - this module reuses the existing AdminAuditLog via logAdminAction(),
//   logging views/searches/exports as well as mutations (see requireBrowserActivityPermission.ts
//   callers), which is why no BrowserActivityAuditLog table appears here.
// - BrowserActivityConsentAck is additive to Devices.ConsentAcceptedAt (which only records
//   "consented once, ever") - it lets a future notice-text revision be distinguished by
//   NoticeVersion without touching the original enrollment consent record.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Devices') AND name = 'BrowserActivityIntervalMinutes')
    ALTER TABLE Devices ADD BrowserActivityIntervalMinutes INT NULL
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DomainCategories' AND xtype='U')
    CREATE TABLE DomainCategories (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(100) NOT NULL,
      RiskLevel VARCHAR(20) NOT NULL DEFAULT 'none',
      IsBuiltIn BIT NOT NULL DEFAULT 0,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_DomainCategories_RiskLevel CHECK (RiskLevel IN ('none','low','medium','high'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='UX_DomainCategories_Name')
    CREATE UNIQUE INDEX UX_DomainCategories_Name ON DomainCategories (Name)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DomainCategoryRules' AND xtype='U')
    CREATE TABLE DomainCategoryRules (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Domain NVARCHAR(255) NOT NULL,
      CategoryId INT NOT NULL REFERENCES DomainCategories(Id) ON DELETE CASCADE,
      MatchType VARCHAR(10) NOT NULL DEFAULT 'suffix',
      Source VARCHAR(20) NOT NULL DEFAULT 'manual',
      CreatedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_DomainCategoryRules_MatchType CHECK (MatchType IN ('exact','suffix')),
      CONSTRAINT CK_DomainCategoryRules_Source CHECK (Source IN ('manual','seed','threat_intel'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='UX_DomainCategoryRules_Domain')
    CREATE UNIQUE INDEX UX_DomainCategoryRules_Domain ON DomainCategoryRules (Domain)
  `;

  // The "approved sensitive domain" opt-out list (personal/medical/banking/union/legal/other) -
  // enforced primarily agent-side (excluded suffixes are pushed via heartbeat and filtered
  // before an event is ever added to the outbound batch) and re-checked at ingest as
  // defense-in-depth. See src/lib/browserActivity/excludedDomainsFilter.ts.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ExcludedDomains' AND xtype='U')
    CREATE TABLE ExcludedDomains (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Domain NVARCHAR(255) NOT NULL,
      Reason VARCHAR(30) NOT NULL,
      Notes NVARCHAR(500) NULL,
      AddedByUserId INT NOT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_ExcludedDomains_Reason CHECK (Reason IN ('personal','medical','banking','union','legal','other'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='UX_ExcludedDomains_Domain')
    CREATE UNIQUE INDEX UX_ExcludedDomains_Domain ON ExcludedDomains (Domain)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BrowserActivityEvents' AND xtype='U')
    CREATE TABLE BrowserActivityEvents (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL REFERENCES Devices(DeviceId),
      StaffId INT NULL,
      Browser VARCHAR(20) NOT NULL,
      Domain NVARCHAR(255) NOT NULL,
      PageTitle NVARCHAR(500) NULL,
      VisitedAt DATETIME2 NOT NULL,
      DwellSeconds INT NULL,
      CategoryId INT NULL REFERENCES DomainCategories(Id),
      RiskLevel VARCHAR(20) NOT NULL DEFAULT 'none',
      IsSecurityEvent BIT NOT NULL DEFAULT 0,
      SecurityEventType VARCHAR(30) NULL,
      ReceivedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_BrowserActivityEvents_Browser CHECK (Browser IN ('chrome','edge','firefox')),
      CONSTRAINT CK_BrowserActivityEvents_RiskLevel CHECK (RiskLevel IN ('none','low','medium','high','blocked')),
      CONSTRAINT CK_BrowserActivityEvents_SecurityEventType CHECK (SecurityEventType IN ('phishing','malware','blocked_domain') OR SecurityEventType IS NULL)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_BrowserActivityEvents_DeviceId_VisitedAt')
    CREATE INDEX IX_BrowserActivityEvents_DeviceId_VisitedAt ON BrowserActivityEvents (DeviceId, VisitedAt DESC)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_BrowserActivityEvents_StaffId_VisitedAt')
    CREATE INDEX IX_BrowserActivityEvents_StaffId_VisitedAt ON BrowserActivityEvents (StaffId, VisitedAt DESC)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_BrowserActivityEvents_Domain')
    CREATE INDEX IX_BrowserActivityEvents_Domain ON BrowserActivityEvents (Domain)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_BrowserActivityEvents_ReceivedAt')
    CREATE INDEX IX_BrowserActivityEvents_ReceivedAt ON BrowserActivityEvents (ReceivedAt)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_BrowserActivityEvents_SecurityEvent')
    CREATE INDEX IX_BrowserActivityEvents_SecurityEvent ON BrowserActivityEvents (IsSecurityEvent, VisitedAt DESC) WHERE IsSecurityEvent = 1
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BrowserActivitySettings' AND xtype='U')
    CREATE TABLE BrowserActivitySettings (
      Id INT NOT NULL PRIMARY KEY DEFAULT 1,
      RetentionDays INT NOT NULL DEFAULT 90,
      CollectPageTitles BIT NOT NULL DEFAULT 1,
      DefaultIntervalMinutes INT NOT NULL DEFAULT 15,
      UpdatedByUserId INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_BrowserActivitySettings_Singleton CHECK (Id = 1)
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BrowserActivityConsentAck' AND xtype='U')
    CREATE TABLE BrowserActivityConsentAck (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL REFERENCES Devices(DeviceId),
      StaffId INT NULL,
      NoticeVersion VARCHAR(20) NOT NULL,
      AcknowledgedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  // Seed the singleton settings row.
  await db.query`
    IF NOT EXISTS (SELECT * FROM BrowserActivitySettings WHERE Id = 1)
    INSERT INTO BrowserActivitySettings (Id) VALUES (1)
  `;

  // Seed built-in categories (idempotent - only inserts names that don't already exist).
  const builtInCategories: { name: string; riskLevel: string }[] = [
    { name: "Business", riskLevel: "none" },
    { name: "Social Media", riskLevel: "low" },
    { name: "File Sharing", riskLevel: "medium" },
    { name: "Entertainment", riskLevel: "low" },
    { name: "Security Risk", riskLevel: "high" },
    { name: "Uncategorized", riskLevel: "none" },
  ];
  for (const cat of builtInCategories) {
    await db
      .request()
      .input("name", sql.NVarChar, cat.name)
      .input("riskLevel", sql.VarChar, cat.riskLevel)
      .query(
        "IF NOT EXISTS (SELECT * FROM DomainCategories WHERE Name = @name) INSERT INTO DomainCategories (Name, RiskLevel, IsBuiltIn) VALUES (@name, @riskLevel, 1)"
      );
  }

  // Seed a small illustrative rule set - all editable/removable via the Domain Categories
  // admin page afterwards. CategoryId is resolved by name since IDENTITY values aren't
  // known ahead of time.
  const seedRules: { domain: string; category: string }[] = [
    { domain: "github.com", category: "Business" },
    { domain: "office.com", category: "Business" },
    { domain: "facebook.com", category: "Social Media" },
    { domain: "instagram.com", category: "Social Media" },
    { domain: "wetransfer.com", category: "File Sharing" },
    { domain: "dropbox.com", category: "File Sharing" },
    { domain: "netflix.com", category: "Entertainment" },
    { domain: "youtube.com", category: "Entertainment" },
  ];
  for (const rule of seedRules) {
    await db
      .request()
      .input("domain", sql.NVarChar, rule.domain)
      .input("category", sql.NVarChar, rule.category)
      .query(`
        IF NOT EXISTS (SELECT * FROM DomainCategoryRules WHERE Domain = @domain)
        INSERT INTO DomainCategoryRules (Domain, CategoryId, MatchType, Source)
        SELECT @domain, Id, 'suffix', 'seed' FROM DomainCategories WHERE Name = @category
      `);
  }

  console.log("Browser Activity Audit schema ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
