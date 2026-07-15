import "dotenv/config";
import { getDb } from "../src/lib/db";

// Website Speed & Performance module. Follows the Website Security Audit sibling's local
// convention (ON DELETE CASCADE off Websites/its own scan table), not the QA module's
// stricter no-cascade rule - this family already establishes that precedent
// (WebsiteScanSchedules, WebsiteAuditScans, etc. all cascade). Every table hangs off the one
// existing `Websites` table via WebsiteId - no new website registry is created.
//
// WebsitePerformanceAlerts/WebsitePerformanceReports.ScanId is deliberately a plain column
// with NO foreign key (not even NO ACTION) - SQL Server rejects a CASCADE path via WebsiteId
// existing alongside a second CASCADE path via ScanId -> WebsitePerformanceScans -> WebsiteId
// ("may cause cycles or multiple cascade paths"), and a non-cascading FK on ScanId would just
// block the parent scan from being deleted rather than adding real value here.

async function main() {
  const db = await getDb();

  // One row per website, only once an admin enables monitoring for it - absence of a row
  // means "not monitored", same pattern as WebsiteScanSchedules.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WebsitePerformanceConfigs' AND xtype='U')
    CREATE TABLE WebsitePerformanceConfigs (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      WebsiteId INT NOT NULL,
      Enabled BIT NOT NULL DEFAULT 0,
      TestDevice NVARCHAR(20) NOT NULL DEFAULT 'Both',
      ScheduleType NVARCHAR(20) NOT NULL DEFAULT 'Daily',
      CustomCron NVARCHAR(100) NULL,
      TimeoutSeconds INT NOT NULL DEFAULT 60,
      ScreenshotCapture BIT NOT NULL DEFAULT 1,
      ScoreThreshold INT NULL,
      LcpThresholdMs INT NULL,
      ClsThreshold FLOAT NULL,
      TbtThresholdMs INT NULL,
      PageSizeThresholdKb INT NULL,
      RequestCountThreshold INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_WebsitePerformanceConfigs_Websites FOREIGN KEY (WebsiteId) REFERENCES Websites(Id) ON DELETE CASCADE,
      CONSTRAINT UQ_WebsitePerformanceConfigs_WebsiteId UNIQUE (WebsiteId)
    )
  `;

  // One row per test run per device (Mobile/Desktop tested separately, never merged) - timing,
  // Core Web Vitals, and scores are inlined here rather than a child table since they're
  // strictly 1:1 with the scan (same "wide scan row" shape WebsiteAuditScans already uses).
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WebsitePerformanceScans' AND xtype='U')
    CREATE TABLE WebsitePerformanceScans (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      WebsiteId INT NOT NULL,
      Device NVARCHAR(10) NOT NULL,
      Status NVARCHAR(20) NOT NULL DEFAULT 'Pending',
      TriggeredBy NVARCHAR(20) NOT NULL DEFAULT 'Manual',
      TriggeredByUserId INT NULL,
      StartedAt DATETIME2 NULL,
      CompletedAt DATETIME2 NULL,
      ErrorMessage NVARCHAR(1000) NULL,
      FinalUrl NVARCHAR(500) NULL,
      HttpStatusCode INT NULL,
      RedirectCount INT NULL,
      ResponseSizeBytes BIGINT NULL,
      HttpProtocol NVARCHAR(10) NULL,
      ServerIp NVARCHAR(45) NULL,
      DnsLookupMs INT NULL,
      TcpConnectMs INT NULL,
      TlsHandshakeMs INT NULL,
      ContentDownloadMs INT NULL,
      TotalResponseTimeMs INT NULL,
      TtfbMs INT NULL,
      FirstContentfulPaintMs INT NULL,
      LargestContentfulPaintMs INT NULL,
      CumulativeLayoutShift FLOAT NULL,
      TotalBlockingTimeMs INT NULL,
      SpeedIndexMs INT NULL,
      TimeToInteractiveMs INT NULL,
      InteractionToNextPaintMs INT NULL,
      DomContentLoadedMs INT NULL,
      FullyLoadedMs INT NULL,
      FirstPaintMs INT NULL,
      OverallScore INT NULL,
      CoreWebVitalsScore INT NULL,
      ServerResponseScore INT NULL,
      ResourceOptimizationScore INT NULL,
      UserExperienceScore INT NULL,
      ScreenshotPath NVARCHAR(500) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_WebsitePerformanceScans_Websites FOREIGN KEY (WebsiteId) REFERENCES Websites(Id) ON DELETE CASCADE
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_WebsitePerformanceScans_Website_Device_CreatedAt')
    CREATE INDEX IX_WebsitePerformanceScans_Website_Device_CreatedAt ON WebsitePerformanceScans (WebsiteId, Device, CreatedAt DESC)
  `;

  // Resource breakdown by type - kept as its own 1:1 child table (not inlined onto the already
  // wide Scans row) purely to keep timing/CWV concerns separate from resource-size concerns.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WebsitePerformanceResourceMetrics' AND xtype='U')
    CREATE TABLE WebsitePerformanceResourceMetrics (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ScanId INT NOT NULL,
      TotalRequests INT NULL,
      TotalTransferredBytes BIGINT NULL,
      TotalUncompressedBytes BIGINT NULL,
      HtmlCount INT NULL,
      HtmlBytes BIGINT NULL,
      CssCount INT NULL,
      CssBytes BIGINT NULL,
      JsCount INT NULL,
      JsBytes BIGINT NULL,
      ImageCount INT NULL,
      ImageBytes BIGINT NULL,
      FontCount INT NULL,
      FontBytes BIGINT NULL,
      MediaCount INT NULL,
      MediaBytes BIGINT NULL,
      ThirdPartyCount INT NULL,
      ThirdPartyBytes BIGINT NULL,
      CachedCount INT NULL,
      FailedCount INT NULL,
      RedirectedCount INT NULL,
      RenderBlockingCount INT NULL,
      UnusedCssBytesEst BIGINT NULL,
      UnusedJsBytesEst BIGINT NULL,
      UnoptimizedImageCount INT NULL,
      CONSTRAINT FK_WebsitePerformanceResourceMetrics_Scans FOREIGN KEY (ScanId) REFERENCES WebsitePerformanceScans(Id) ON DELETE CASCADE,
      CONSTRAINT UQ_WebsitePerformanceResourceMetrics_ScanId UNIQUE (ScanId)
    )
  `;

  // Many rows per scan - one per Lighthouse/PSI audit we surface (render-blocking resources,
  // unused CSS/JS, modern image formats, text compression, etc.).
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WebsiteOptimizationChecks' AND xtype='U')
    CREATE TABLE WebsiteOptimizationChecks (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ScanId INT NOT NULL,
      CheckKey NVARCHAR(80) NOT NULL,
      CheckName NVARCHAR(200) NOT NULL,
      Status NVARCHAR(20) NOT NULL,
      Severity NVARCHAR(20) NOT NULL,
      CurrentValueText NVARCHAR(200) NULL,
      RecommendedValueText NVARCHAR(200) NULL,
      Description NVARCHAR(1000) NULL,
      Recommendation NVARCHAR(1000) NULL,
      EstimatedSavingsMs INT NULL,
      EstimatedSavingsBytes BIGINT NULL,
      AffectedResourceCount INT NULL,
      CONSTRAINT FK_WebsiteOptimizationChecks_Scans FOREIGN KEY (ScanId) REFERENCES WebsitePerformanceScans(Id) ON DELETE CASCADE
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_WebsiteOptimizationChecks_ScanId')
    CREATE INDEX IX_WebsiteOptimizationChecks_ScanId ON WebsiteOptimizationChecks (ScanId)
  `;

  // Feeds src/lib/alerts.ts's getRecentAlerts() UNION - no second notification/alert system.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WebsitePerformanceAlerts' AND xtype='U')
    CREATE TABLE WebsitePerformanceAlerts (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      WebsiteId INT NOT NULL,
      ScanId INT NULL,
      AlertType NVARCHAR(50) NOT NULL,
      Severity NVARCHAR(20) NOT NULL,
      Detail NVARCHAR(500) NOT NULL,
      TriggeredAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      ResolvedAt DATETIME2 NULL,
      CONSTRAINT FK_WebsitePerformanceAlerts_Websites FOREIGN KEY (WebsiteId) REFERENCES Websites(Id) ON DELETE CASCADE
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_WebsitePerformanceAlerts_Unresolved')
    CREATE INDEX IX_WebsitePerformanceAlerts_Unresolved ON WebsitePerformanceAlerts (ResolvedAt, TriggeredAt DESC)
  `;

  // Mirrors WebsiteAuditReports - a generated-report registry, not the report content itself.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WebsitePerformanceReports' AND xtype='U')
    CREATE TABLE WebsitePerformanceReports (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      WebsiteId INT NOT NULL,
      ScanId INT NULL,
      Format NVARCHAR(10) NOT NULL,
      FilePath NVARCHAR(500) NULL,
      GeneratedByUserId INT NULL,
      GeneratedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_WebsitePerformanceReports_Websites FOREIGN KEY (WebsiteId) REFERENCES Websites(Id) ON DELETE CASCADE
    )
  `;

  console.log("Website Speed & Performance tables ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
