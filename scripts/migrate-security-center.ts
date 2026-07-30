import "dotenv/config";
import { getDb } from "../src/lib/db";

// Security Center Phase 1: Vulnerability Scanner + WAF rule configuration + score trend
// snapshots. This is an aggregation layer over several already-built modules (Malware
// Detection, Intrusion Detection/DDoS, Security Headers, Website & API Monitoring) - see the
// approved plan for why no duplicate schema exists for those. IP/CIDR blocking specifically
// reuses Intrusion Detection's existing SecurityIpBlocklist/SecurityIpAllowlist tables
// (migrate-intrusion-detection.ts) rather than a second copy.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='VulnerabilityScans' AND xtype='U')
    CREATE TABLE VulnerabilityScans (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      WebsiteId INT NULL REFERENCES Websites(Id),
      TargetUrl NVARCHAR(2000) NOT NULL,
      IsAdHocTarget BIT NOT NULL DEFAULT 0,
      AuthorizedByUserId INT NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'Pending',
      StartedAt DATETIME2 NULL,
      CompletedAt DATETIME2 NULL,
      ChecksRun INT NOT NULL DEFAULT 0,
      RequestedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_VulnerabilityScans_Status CHECK (Status IN ('Pending','Running','Completed','Failed')),
      -- An ad-hoc (not-yet-tracked) target must carry an explicit authorizing user - the
      -- "systems the organisation owns or is explicitly authorised to assess" requirement is
      -- enforced here at the schema level, not just hidden client-side.
      CONSTRAINT CK_VulnerabilityScans_AdHocAuthorized CHECK (IsAdHocTarget = 0 OR AuthorizedByUserId IS NOT NULL)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_VulnerabilityScans_CreatedAt')
    CREATE INDEX IX_VulnerabilityScans_CreatedAt ON VulnerabilityScans (CreatedAt DESC)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='VulnerabilityFindings' AND xtype='U')
    CREATE TABLE VulnerabilityFindings (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ScanId INT NOT NULL REFERENCES VulnerabilityScans(Id) ON DELETE CASCADE,
      CheckType VARCHAR(60) NOT NULL,
      Severity VARCHAR(20) NOT NULL,
      CvssScore DECIMAL(3,1) NULL,
      Cwe VARCHAR(20) NULL,
      Cve VARCHAR(30) NULL,
      Title NVARCHAR(300) NOT NULL,
      Description NVARCHAR(MAX) NULL,
      Risk NVARCHAR(MAX) NULL,
      Evidence NVARCHAR(MAX) NULL,
      AffectedUrl NVARCHAR(2000) NULL,
      Parameter NVARCHAR(200) NULL,
      HttpRequestSnippet NVARCHAR(MAX) NULL,
      HttpResponseSnippet NVARCHAR(MAX) NULL,
      Remediation NVARCHAR(MAX) NULL,
      ReferencesJson NVARCHAR(MAX) NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'Open',
      AssignedEngineerUserId INT NULL,
      Notes NVARCHAR(MAX) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_VulnerabilityFindings_Severity CHECK (Severity IN ('Critical','High','Medium','Low','Informational')),
      CONSTRAINT CK_VulnerabilityFindings_Status CHECK (Status IN ('Open','Confirmed','FalsePositive','Resolved','Accepted'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_VulnerabilityFindings_ScanId')
    CREATE INDEX IX_VulnerabilityFindings_ScanId ON VulnerabilityFindings (ScanId)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_VulnerabilityFindings_Severity_Status')
    CREATE INDEX IX_VulnerabilityFindings_Severity_Status ON VulnerabilityFindings (Severity, Status)
  `;

  // WAF: rule configuration only. IP/CIDR blocking deliberately reuses
  // SecurityIpBlocklist/SecurityIpAllowlist (Intrusion Detection) rather than a duplicate table.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WafRateLimitRules' AND xtype='U')
    CREATE TABLE WafRateLimitRules (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      WebsiteId INT NULL REFERENCES Websites(Id),
      Name NVARCHAR(200) NOT NULL,
      RequestsPerWindow INT NOT NULL,
      WindowSeconds INT NOT NULL,
      Action VARCHAR(20) NOT NULL DEFAULT 'LogOnly',
      IsActive BIT NOT NULL DEFAULT 1,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_WafRateLimitRules_Action CHECK (Action IN ('Block','Challenge','LogOnly'))
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WafCustomRules' AND xtype='U')
    CREATE TABLE WafCustomRules (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(200) NOT NULL,
      MatchType VARCHAR(20) NOT NULL,
      MatchValue NVARCHAR(1000) NOT NULL,
      Action VARCHAR(20) NOT NULL DEFAULT 'LogOnly',
      IsActive BIT NOT NULL DEFAULT 1,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_WafCustomRules_MatchType CHECK (MatchType IN ('UrlPattern','UserAgentPattern','HeaderPattern')),
      CONSTRAINT CK_WafCustomRules_Action CHECK (Action IN ('Block','Allow','LogOnly'))
    )
  `;

  // Action is logged/informational only in Phase 1 (see plan) - real per-country enforcement
  // needs a GeoIP-to-CIDR mapping this repo doesn't have yet.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WafCountryRules' AND xtype='U')
    CREATE TABLE WafCountryRules (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      CountryCode CHAR(2) NOT NULL,
      Action VARCHAR(20) NOT NULL DEFAULT 'Block',
      IsActive BIT NOT NULL DEFAULT 1,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_WafCountryRules_Action CHECK (Action IN ('Block','Allow'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_WafCountryRules_CountryCode')
    CREATE UNIQUE INDEX IX_WafCountryRules_CountryCode ON WafCountryRules (CountryCode)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityCenterScoreSnapshots' AND xtype='U')
    CREATE TABLE SecurityCenterScoreSnapshots (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      SnapshotAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      OverallScore INT NOT NULL,
      ComponentScoresJson NVARCHAR(MAX) NOT NULL
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SecurityCenterScoreSnapshots_SnapshotAt')
    CREATE INDEX IX_SecurityCenterScoreSnapshots_SnapshotAt ON SecurityCenterScoreSnapshots (SnapshotAt DESC)
  `;

  console.log("Security Center schema ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
