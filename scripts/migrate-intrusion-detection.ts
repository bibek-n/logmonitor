import "dotenv/config";
import { getDb, sql } from "../src/lib/db";
import { STARTER_RULES } from "../src/lib/intrusionDetection/starterRules";

async function addColumnIfMissing(db: Awaited<ReturnType<typeof getDb>>, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

// Website Intrusion Detection System - schema for all Phase 1 + Phase 2 tables (Phase 2
// tables are created now since the DDL is cheap and it unblocks that follow-up work, even
// though the application code that populates/reads file-integrity/notification-delivery/
// response-action tables doesn't exist yet - see the IDS Phase 2 tasks).
//
// Every table is prefixed `Security` to guarantee zero collision with existing tables and
// to make "what belongs to this feature" obvious at a glance in SSMS/queries.
async function main() {
  const db = await getDb();

  // --- Core: what's being monitored ---------------------------------------------------
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityProtectedApplications' AND xtype='U')
    CREATE TABLE SecurityProtectedApplications (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(200) NOT NULL,
      AppType VARCHAR(30) NOT NULL,
      BaseUrl NVARCHAR(500) NULL,
      IsActive BIT NOT NULL DEFAULT 1,
      Notes NVARCHAR(1000) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_SecurityProtectedApplications_AppType CHECK (AppType IN ('WebApp','Firewall','Router','Server','Other'))
    )
  `;

  // Links a protected application back to the app's existing Websites table (the same list
  // Security Headers, WP Scan, and Website Speed & Performance already read from) so IDS
  // reuses that registry instead of maintaining its own separate website list. NULL for
  // non-website protected apps (LogMonitor itself, the Sophos firewall).
  await addColumnIfMissing(db, "SecurityProtectedApplications", "WebsiteId", "INT NULL");
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_SecurityProtectedApplications_Website')
    ALTER TABLE SecurityProtectedApplications ADD CONSTRAINT FK_SecurityProtectedApplications_Website
      FOREIGN KEY (WebsiteId) REFERENCES Websites(Id) ON DELETE SET NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SecurityProtectedApplications_WebsiteId' AND object_id = OBJECT_ID('SecurityProtectedApplications'))
    CREATE UNIQUE INDEX IX_SecurityProtectedApplications_WebsiteId ON SecurityProtectedApplications (WebsiteId) WHERE WebsiteId IS NOT NULL
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityLogSources' AND xtype='U')
    CREATE TABLE SecurityLogSources (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ProtectedApplicationId INT NOT NULL,
      Name NVARCHAR(200) NOT NULL,
      AdapterType VARCHAR(40) NOT NULL,
      Enabled BIT NOT NULL DEFAULT 1,
      ConfigJson NVARCHAR(MAX) NOT NULL DEFAULT '{}',
      LastPositionFile NVARCHAR(1000) NULL,
      LastPosition BIGINT NOT NULL DEFAULT 0,
      LastFileSize BIGINT NULL,
      LastFileInode NVARCHAR(100) NULL,
      LastRunAt DATETIME2 NULL,
      LastRunStatus VARCHAR(20) NULL,
      LastErrorMessage NVARCHAR(1000) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_SecurityLogSources_App FOREIGN KEY (ProtectedApplicationId) REFERENCES SecurityProtectedApplications(Id) ON DELETE CASCADE
    )
  `;

  // --- Normalized events (every adapter writes here) -----------------------------------
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityEvents' AND xtype='U')
    CREATE TABLE SecurityEvents (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY,
      LogSourceId INT NULL,
      ProtectedApplicationId INT NULL,
      DataSource VARCHAR(30) NOT NULL,
      EventTime DATETIME2 NOT NULL,
      SourceIp VARCHAR(45) NULL,
      DestinationHost NVARCHAR(255) NULL,
      RequestMethod VARCHAR(10) NULL,
      RequestPath NVARCHAR(2000) NULL,
      ResponseStatus INT NULL,
      UserAgent NVARCHAR(500) NULL,
      UserAccount NVARCHAR(100) NULL,
      -- Sanitized, length-capped summary only - request bodies are never collected (see
      -- REQUEST_BODY_COLLECTION_ENABLED in config.ts, off by default) and headers are
      -- redacted before anything reaches this column. Never store secrets/tokens here.
      EvidenceSummary NVARCHAR(2000) NULL,
      FieldsJson NVARCHAR(MAX) NULL,
      AlertId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_SecurityEvents_LogSource FOREIGN KEY (LogSourceId) REFERENCES SecurityLogSources(Id) ON DELETE SET NULL,
      -- NO ACTION (not SET NULL): SecurityLogSources already cascades from
      -- SecurityProtectedApplications, and SQL Server disallows a second cascading path to the
      -- same table. A ProtectedApplication with existing SecurityEvents cannot be deleted.
      CONSTRAINT FK_SecurityEvents_App FOREIGN KEY (ProtectedApplicationId) REFERENCES SecurityProtectedApplications(Id) ON DELETE NO ACTION
    )
  `;
  await db.query`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SecurityEvents_EventTime') CREATE INDEX IX_SecurityEvents_EventTime ON SecurityEvents (EventTime DESC)`;
  await db.query`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SecurityEvents_SourceIp') CREATE INDEX IX_SecurityEvents_SourceIp ON SecurityEvents (SourceIp)`;
  await db.query`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SecurityEvents_AlertId') CREATE INDEX IX_SecurityEvents_AlertId ON SecurityEvents (AlertId)`;
  await db.query`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SecurityEvents_DataSource') CREATE INDEX IX_SecurityEvents_DataSource ON SecurityEvents (DataSource, EventTime DESC)`;

  // --- Detection rules -------------------------------------------------------------------
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityDetectionRules' AND xtype='U')
    CREATE TABLE SecurityDetectionRules (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      RuleKey VARCHAR(100) NOT NULL UNIQUE,
      Name NVARCHAR(200) NOT NULL,
      Description NVARCHAR(1000) NULL,
      Category VARCHAR(40) NOT NULL,
      Severity VARCHAR(20) NOT NULL,
      Confidence INT NOT NULL,
      DataSource VARCHAR(40) NOT NULL,
      Enabled BIT NOT NULL DEFAULT 1,
      ConditionsJson NVARCHAR(MAX) NOT NULL,
      ExclusionsJson NVARCHAR(MAX) NOT NULL DEFAULT '[]',
      ThresholdCount INT NOT NULL DEFAULT 1,
      ThresholdWindowSeconds INT NOT NULL DEFAULT 60,
      GroupingKeyTemplate NVARCHAR(200) NOT NULL DEFAULT '{ruleKey}:{sourceIp}',
      CooldownSeconds INT NOT NULL DEFAULT 300,
      Tags NVARCHAR(500) NULL,
      RecommendedAction NVARCHAR(1000) NULL,
      References_ NVARCHAR(1000) NULL,
      Version INT NOT NULL DEFAULT 1,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_SecurityDetectionRules_Severity CHECK (Severity IN ('informational','low','medium','high','critical')),
      CONSTRAINT CK_SecurityDetectionRules_Confidence CHECK (Confidence BETWEEN 0 AND 100)
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityRuleExclusions' AND xtype='U')
    CREATE TABLE SecurityRuleExclusions (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      RuleId INT NULL,
      ExclusionType VARCHAR(20) NOT NULL,
      Value NVARCHAR(500) NOT NULL,
      Reason NVARCHAR(500) NULL,
      CreatedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_SecurityRuleExclusions_Rule FOREIGN KEY (RuleId) REFERENCES SecurityDetectionRules(Id) ON DELETE CASCADE,
      CONSTRAINT CK_SecurityRuleExclusions_Type CHECK (ExclusionType IN ('IP','Path','UserAgent'))
    )
  `;

  // --- IP reputation / allow-block lists -------------------------------------------------
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityIpProfiles' AND xtype='U')
    CREATE TABLE SecurityIpProfiles (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      IpAddress VARCHAR(45) NOT NULL UNIQUE,
      FirstSeenAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      LastSeenAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      TotalEvents INT NOT NULL DEFAULT 0,
      TotalAlerts INT NOT NULL DEFAULT 0,
      CountryCode CHAR(2) NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;
  await db.query`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SecurityIpProfiles_LastSeenAt') CREATE INDEX IX_SecurityIpProfiles_LastSeenAt ON SecurityIpProfiles (LastSeenAt DESC)`;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityIpAllowlist' AND xtype='U')
    CREATE TABLE SecurityIpAllowlist (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      IpOrCidr VARCHAR(50) NOT NULL,
      Reason NVARCHAR(500) NULL,
      CreatedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      ExpiresAt DATETIME2 NULL
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityIpBlocklist' AND xtype='U')
    CREATE TABLE SecurityIpBlocklist (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      IpOrCidr VARCHAR(50) NOT NULL,
      Reason NVARCHAR(500) NULL,
      Source VARCHAR(20) NOT NULL DEFAULT 'Manual',
      CreatedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      ExpiresAt DATETIME2 NULL,
      IsActive BIT NOT NULL DEFAULT 1,
      CONSTRAINT CK_SecurityIpBlocklist_Source CHECK (Source IN ('Manual','Rule','Auto'))
    )
  `;

  // --- Alerts ------------------------------------------------------------------------------
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityAlerts' AND xtype='U')
    CREATE TABLE SecurityAlerts (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      RuleId INT NULL,
      ProtectedApplicationId INT NULL,
      Category VARCHAR(40) NOT NULL,
      Severity VARCHAR(20) NOT NULL,
      Confidence INT NOT NULL,
      RiskScore INT NOT NULL,
      SourceIp VARCHAR(45) NULL,
      DestinationHost NVARCHAR(255) NULL,
      RequestMethod VARCHAR(10) NULL,
      RequestPath NVARCHAR(2000) NULL,
      ResponseStatus INT NULL,
      UserAgent NVARCHAR(500) NULL,
      UserAccount NVARCHAR(100) NULL,
      EvidenceSummary NVARCHAR(2000) NULL,
      RecommendedAction NVARCHAR(1000) NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'New',
      GroupingKey NVARCHAR(300) NOT NULL,
      FirstSeenAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      LastSeenAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      OccurrenceCount INT NOT NULL DEFAULT 1,
      SuppressedUntil DATETIME2 NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_SecurityAlerts_Rule FOREIGN KEY (RuleId) REFERENCES SecurityDetectionRules(Id) ON DELETE SET NULL,
      -- NO ACTION: avoids a second cascading path to SecurityAlerts/SecurityEvents alongside
      -- the ProtectedApplications -> SecurityLogSources -> SecurityEvents cascade chain.
      CONSTRAINT FK_SecurityAlerts_App FOREIGN KEY (ProtectedApplicationId) REFERENCES SecurityProtectedApplications(Id) ON DELETE NO ACTION,
      CONSTRAINT CK_SecurityAlerts_Severity CHECK (Severity IN ('informational','low','medium','high','critical')),
      CONSTRAINT CK_SecurityAlerts_Status CHECK (Status IN ('New','Investigating','Confirmed','FalsePositive','Resolved','Suppressed'))
    )
  `;
  await db.query`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SecurityAlerts_CreatedAt') CREATE INDEX IX_SecurityAlerts_CreatedAt ON SecurityAlerts (CreatedAt DESC)`;
  await db.query`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SecurityAlerts_Severity') CREATE INDEX IX_SecurityAlerts_Severity ON SecurityAlerts (Severity)`;
  await db.query`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SecurityAlerts_Status') CREATE INDEX IX_SecurityAlerts_Status ON SecurityAlerts (Status)`;
  await db.query`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SecurityAlerts_SourceIp') CREATE INDEX IX_SecurityAlerts_SourceIp ON SecurityAlerts (SourceIp)`;
  await db.query`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SecurityAlerts_Category') CREATE INDEX IX_SecurityAlerts_Category ON SecurityAlerts (Category)`;
  await db.query`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SecurityAlerts_GroupingKey') CREATE INDEX IX_SecurityAlerts_GroupingKey ON SecurityAlerts (GroupingKey)`;

  // Deferred FK from SecurityEvents.AlertId, added after SecurityAlerts exists.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_SecurityEvents_Alert')
    ALTER TABLE SecurityEvents ADD CONSTRAINT FK_SecurityEvents_Alert FOREIGN KEY (AlertId) REFERENCES SecurityAlerts(Id) ON DELETE SET NULL
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityAlertNotes' AND xtype='U')
    CREATE TABLE SecurityAlertNotes (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      AlertId INT NOT NULL,
      UserId INT NULL,
      Username NVARCHAR(100) NULL,
      Note NVARCHAR(MAX) NOT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_SecurityAlertNotes_Alert FOREIGN KEY (AlertId) REFERENCES SecurityAlerts(Id) ON DELETE CASCADE
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityAlertStatusHistory' AND xtype='U')
    CREATE TABLE SecurityAlertStatusHistory (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      AlertId INT NOT NULL,
      OldStatus VARCHAR(20) NULL,
      NewStatus VARCHAR(20) NOT NULL,
      ChangedByUserId INT NULL,
      ChangedByUsername NVARCHAR(100) NULL,
      Reason NVARCHAR(500) NULL,
      ChangedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_SecurityAlertStatusHistory_Alert FOREIGN KEY (AlertId) REFERENCES SecurityAlerts(Id) ON DELETE CASCADE
    )
  `;

  // --- Response actions (Phase 2 - schema now, execution service not yet built) ---------
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityResponseActions' AND xtype='U')
    CREATE TABLE SecurityResponseActions (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      AlertId INT NULL,
      ActionType VARCHAR(40) NOT NULL,
      TargetValue NVARCHAR(200) NOT NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'Pending',
      DryRun BIT NOT NULL DEFAULT 1,
      RequestedByUserId INT NULL,
      RequestedByUsername NVARCHAR(100) NULL,
      RequestedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      ExecutedAt DATETIME2 NULL,
      Result NVARCHAR(1000) NULL,
      ExpiresAt DATETIME2 NULL,
      CONSTRAINT FK_SecurityResponseActions_Alert FOREIGN KEY (AlertId) REFERENCES SecurityAlerts(Id) ON DELETE SET NULL,
      CONSTRAINT CK_SecurityResponseActions_Status CHECK (Status IN ('Pending','Simulated','Executed','Failed','RolledBack'))
    )
  `;

  // --- Notification channels (Phase 2 - schema now; email reuses existing SMTP in Phase 1) ---
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityNotificationChannels' AND xtype='U')
    CREATE TABLE SecurityNotificationChannels (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ChannelType VARCHAR(20) NOT NULL,
      Name NVARCHAR(200) NOT NULL,
      -- Secrets (bot tokens, webhook URLs) are AES-256-GCM encrypted before storage - see
      -- src/lib/intrusionDetection/secretCrypto.ts - never stored or logged in plaintext.
      EncryptedConfig NVARCHAR(MAX) NULL,
      Enabled BIT NOT NULL DEFAULT 1,
      MinSeverity VARCHAR(20) NOT NULL DEFAULT 'high',
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityNotificationDeliveries' AND xtype='U')
    CREATE TABLE SecurityNotificationDeliveries (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      AlertId INT NULL,
      ChannelId INT NULL,
      ChannelType VARCHAR(20) NOT NULL,
      Status VARCHAR(20) NOT NULL,
      AttemptCount INT NOT NULL DEFAULT 1,
      ErrorMessage NVARCHAR(1000) NULL,
      SentAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_SecurityNotificationDeliveries_Alert FOREIGN KEY (AlertId) REFERENCES SecurityAlerts(Id) ON DELETE SET NULL,
      CONSTRAINT FK_SecurityNotificationDeliveries_Channel FOREIGN KEY (ChannelId) REFERENCES SecurityNotificationChannels(Id) ON DELETE SET NULL
    )
  `;

  // --- File integrity (Phase 2 - schema only) --------------------------------------------
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityFileIntegrityBaselines' AND xtype='U')
    CREATE TABLE SecurityFileIntegrityBaselines (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      FilePath NVARCHAR(1000) NOT NULL,
      Sha256Hash CHAR(64) NOT NULL,
      SizeBytes BIGINT NOT NULL,
      Permissions NVARCHAR(50) NULL,
      ApprovedByUserId INT NULL,
      LastVerifiedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;
  await db.query`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SecurityFileIntegrityBaselines_FilePath') CREATE UNIQUE INDEX IX_SecurityFileIntegrityBaselines_FilePath ON SecurityFileIntegrityBaselines (FilePath)`;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityFileIntegrityEvents' AND xtype='U')
    CREATE TABLE SecurityFileIntegrityEvents (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      FilePath NVARCHAR(1000) NOT NULL,
      ChangeType VARCHAR(20) NOT NULL,
      OldHash CHAR(64) NULL,
      NewHash CHAR(64) NULL,
      DetectedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      Acknowledged BIT NOT NULL DEFAULT 0,
      CONSTRAINT CK_SecurityFileIntegrityEvents_ChangeType CHECK (ChangeType IN ('Created','Modified','Deleted'))
    )
  `;

  // --- Collector health + retention -------------------------------------------------------
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityCollectorHealth' AND xtype='U')
    CREATE TABLE SecurityCollectorHealth (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      LogSourceId INT NULL,
      CheckedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      Status VARCHAR(20) NOT NULL,
      Message NVARCHAR(500) NULL,
      EventsProcessedLastRun INT NOT NULL DEFAULT 0,
      DurationMs INT NULL,
      CONSTRAINT FK_SecurityCollectorHealth_LogSource FOREIGN KEY (LogSourceId) REFERENCES SecurityLogSources(Id) ON DELETE CASCADE
    )
  `;
  await db.query`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SecurityCollectorHealth_CheckedAt') CREATE INDEX IX_SecurityCollectorHealth_CheckedAt ON SecurityCollectorHealth (CheckedAt DESC)`;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityRetentionSettings' AND xtype='U')
    CREATE TABLE SecurityRetentionSettings (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DataType VARCHAR(40) NOT NULL UNIQUE,
      RetentionDays INT NOT NULL,
      LastCleanupAt DATETIME2 NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  // --- Lightweight RBAC tier, additive to the existing Admin-only role system -----------
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityUserRoles' AND xtype='U')
    CREATE TABLE SecurityUserRoles (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      UserId INT NOT NULL UNIQUE,
      Role VARCHAR(20) NOT NULL,
      GrantedByUserId INT NULL,
      GrantedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_SecurityUserRoles_Role CHECK (Role IN ('security_admin','security_analyst','viewer'))
    )
  `;

  // --- Seed default retention + a protected-application row for this app itself --------
  await db.query`
    IF NOT EXISTS (SELECT * FROM SecurityRetentionSettings WHERE DataType = 'SecurityEvents')
    INSERT INTO SecurityRetentionSettings (DataType, RetentionDays) VALUES ('SecurityEvents', 90)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM SecurityRetentionSettings WHERE DataType = 'SecurityAlerts')
    INSERT INTO SecurityRetentionSettings (DataType, RetentionDays) VALUES ('SecurityAlerts', 365)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM SecurityProtectedApplications WHERE Name = 'LogMonitor (this app)')
    INSERT INTO SecurityProtectedApplications (Name, AppType, BaseUrl, Notes)
    VALUES ('LogMonitor (this app)', 'WebApp', 'http://192.168.1.15:9500', 'The logmonitor Next.js application itself, hosted via IIS/iisnode.')
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM SecurityProtectedApplications WHERE Name = 'Sophos Firewall')
    INSERT INTO SecurityProtectedApplications (Name, AppType, Notes)
    VALUES ('Sophos Firewall', 'Firewall', 'Threat/IPS and web-filter events ingested via existing SophosThreatLogs/WebFilterLogs tables.')
  `;

  // Register every currently-enabled website from the app's existing Websites list (the
  // same registry Security Headers, WP Scan, and Website Speed & Performance already read
  // from - "Audit Websites & SSL Certificates" in the nav) as a protected application, so
  // IDS covers them without a separate, duplicate website list. Ongoing sync (as websites
  // are added/removed later) happens every collection pass via syncProtectedWebsites() -
  // this migration-time pass is just the initial bootstrap.
  const existingWebsites = await db.query<{ Id: number; Name: string; Url: string }>`SELECT Id, Name, Url FROM Websites WHERE Enabled = 1`;
  for (const site of existingWebsites.recordset) {
    await db
      .request()
      .input("websiteId", sql.Int, site.Id)
      .input("name", sql.NVarChar, site.Name)
      .input("url", sql.NVarChar, site.Url)
      .query(`
        IF EXISTS (SELECT * FROM SecurityProtectedApplications WHERE WebsiteId = @websiteId)
          UPDATE SecurityProtectedApplications SET Name = @name, BaseUrl = @url, IsActive = 1 WHERE WebsiteId = @websiteId
        ELSE
          INSERT INTO SecurityProtectedApplications (Name, AppType, BaseUrl, WebsiteId, Notes)
          VALUES (@name, 'WebApp', @url, @websiteId, 'Synced from the Websites list (Audit Websites & SSL Certificates).')
      `);
  }

  // Seed one log source per adapter, wired to the two protected-application rows above.
  // LastPosition starts at 0 so the first collection run picks up every existing row/line -
  // on a table with meaningful history (SophosThreatLogs, WebFilterLogs, LoginActivity)
  // that means the very first run processes the full backlog, which is intentional: this is
  // free, valuable historical signal that already exists, not something to skip.
  const logMonitorApp = await db.query<{ Id: number }>`SELECT Id FROM SecurityProtectedApplications WHERE Name = 'LogMonitor (this app)'`;
  const sophosApp = await db.query<{ Id: number }>`SELECT Id FROM SecurityProtectedApplications WHERE Name = 'Sophos Firewall'`;
  const logMonitorAppId = logMonitorApp.recordset[0].Id;
  const sophosAppId = sophosApp.recordset[0].Id;

  const logSourceSeeds: { name: string; appId: number; adapterType: string; configJson: string }[] = [
    { name: "Sophos Threat/IPS Logs", appId: sophosAppId, adapterType: "SophosThreat", configJson: "{}" },
    { name: "Sophos Web Filter Logs", appId: sophosAppId, adapterType: "SophosWebFilter", configJson: "{}" },
    { name: "LogMonitor Login Activity", appId: logMonitorAppId, adapterType: "AdminAuditLog", configJson: "{}" },
    {
      name: "LogMonitor IIS Access Log",
      appId: logMonitorAppId,
      adapterType: "IisAccessLog",
      // Confirmed against IIS site bindings on 192.168.1.15: LogMonitor is site ID 40
      // (Get-Website | Where Name -eq LogMonitor -> id=40), not the default W3SVC1.
      configJson: JSON.stringify({ logDirectory: "C:\\inetpub\\logs\\LogFiles\\W3SVC40" }),
    },
  ];

  for (const seed of logSourceSeeds) {
    await db
      .request()
      .input("name", sql.NVarChar, seed.name)
      .input("appId", sql.Int, seed.appId)
      .input("adapterType", sql.VarChar, seed.adapterType)
      .input("configJson", sql.NVarChar, seed.configJson)
      .query(`
        IF NOT EXISTS (SELECT * FROM SecurityLogSources WHERE Name = @name)
        INSERT INTO SecurityLogSources (ProtectedApplicationId, Name, AdapterType, ConfigJson)
        VALUES (@appId, @name, @adapterType, @configJson)
      `);
  }

  // Exclude LogMonitor's own internal device-agent polling API from detection - it uses a
  // generic Go-http-client user agent and polls constantly, which floods automated-bot-
  // user-agent (and similar) rules with false positives. Always authenticated (deviceId +
  // token), never user-facing, so it's safe to exclude globally rather than per-rule.
  await db.query`
    IF NOT EXISTS (SELECT * FROM SecurityRuleExclusions WHERE ExclusionType = 'Path' AND Value = '^/api/agent/')
    INSERT INTO SecurityRuleExclusions (RuleId, ExclusionType, Value, Reason)
    VALUES (NULL, 'Path', '^/api/agent/', 'LogMonitor internal device-agent polling API - authenticated, not user-facing, generates constant bot-like traffic')
  `;

  // Seed the starter rule set - only inserts rules that don't already exist by RuleKey, so
  // re-running this migration never clobbers an admin's later edits (enable/disable,
  // retuned thresholds) to an existing rule row.
  for (const rule of STARTER_RULES) {
    await db
      .request()
      .input("ruleKey", sql.VarChar, rule.ruleKey)
      .input("name", sql.NVarChar, rule.name)
      .input("description", sql.NVarChar, rule.description)
      .input("category", sql.VarChar, rule.category)
      .input("severity", sql.VarChar, rule.severity)
      .input("confidence", sql.Int, rule.confidence)
      .input("dataSource", sql.VarChar, rule.dataSource)
      .input("conditionsJson", sql.NVarChar, JSON.stringify(rule.conditions))
      .input("thresholdCount", sql.Int, rule.thresholdCount)
      .input("thresholdWindowSeconds", sql.Int, rule.thresholdWindowSeconds)
      .input("cooldownSeconds", sql.Int, rule.cooldownSeconds)
      .input("tags", sql.NVarChar, rule.tags.join(","))
      .input("recommendedAction", sql.NVarChar, rule.recommendedAction)
      .input("references_", sql.NVarChar, rule.references.join(","))
      .query(`
        IF NOT EXISTS (SELECT * FROM SecurityDetectionRules WHERE RuleKey = @ruleKey)
        INSERT INTO SecurityDetectionRules
          (RuleKey, Name, Description, Category, Severity, Confidence, DataSource, ConditionsJson, ThresholdCount, ThresholdWindowSeconds, CooldownSeconds, Tags, RecommendedAction, References_)
        VALUES
          (@ruleKey, @name, @description, @category, @severity, @confidence, @dataSource, @conditionsJson, @thresholdCount, @thresholdWindowSeconds, @cooldownSeconds, @tags, @recommendedAction, @references_)
      `);
  }
  console.log(`Seeded/verified ${STARTER_RULES.length} starter detection rules.`);

  console.log("Intrusion Detection System schema ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
