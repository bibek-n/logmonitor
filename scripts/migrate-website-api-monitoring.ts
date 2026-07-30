import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Monitors' AND xtype='U')
    CREATE TABLE Monitors (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      MonitorType VARCHAR(20) NOT NULL,
      Name NVARCHAR(200) NOT NULL,
      Description NVARCHAR(1000) NULL,
      Environment VARCHAR(50) NULL,
      Tags NVARCHAR(500) NULL,
      IntervalSeconds INT NOT NULL DEFAULT 300,
      TimeoutMs INT NOT NULL DEFAULT 10000,
      FailureConfirmCount INT NOT NULL DEFAULT 2,
      RecoveryConfirmCount INT NOT NULL DEFAULT 1,
      AlertPolicyId INT NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'Pending',
      ConsecutiveFailures INT NOT NULL DEFAULT 0,
      ConsecutiveSuccesses INT NOT NULL DEFAULT 0,
      IsActive BIT NOT NULL DEFAULT 1,
      LastCheckedAt DATETIME2 NULL,
      NextCheckAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CreatedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      IsDeleted BIT NOT NULL DEFAULT 0,
      CONSTRAINT CK_Monitors_Type CHECK (MonitorType IN ('Website','Api')),
      CONSTRAINT CK_Monitors_Status CHECK (Status IN ('Up','Down','Degraded','Paused','Maintenance','Unknown','Pending'))
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WebsiteMonitorConfigs' AND xtype='U')
    CREATE TABLE WebsiteMonitorConfigs (
      MonitorId INT PRIMARY KEY REFERENCES Monitors(Id) ON DELETE CASCADE,
      Url NVARCHAR(2000) NOT NULL,
      HttpMethod VARCHAR(10) NOT NULL DEFAULT 'GET',
      ExpectedStatusCode INT NOT NULL DEFAULT 200,
      FollowRedirects BIT NOT NULL DEFAULT 1,
      MaxRedirects INT NOT NULL DEFAULT 5,
      SslVerify BIT NOT NULL DEFAULT 1,
      ExpectedKeyword NVARCHAR(500) NULL,
      ForbiddenKeyword NVARCHAR(500) NULL,
      ResponseTimeWarningMs INT NOT NULL DEFAULT 1000,
      ResponseTimeCriticalMs INT NOT NULL DEFAULT 3000
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MonitorResults' AND xtype='U')
    CREATE TABLE MonitorResults (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY,
      MonitorId INT NOT NULL REFERENCES Monitors(Id) ON DELETE CASCADE,
      CheckedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      Success BIT NOT NULL,
      HttpStatusCode INT NULL,
      DnsMs INT NULL,
      TcpMs INT NULL,
      TlsMs INT NULL,
      TtfbMs INT NULL,
      TotalMs INT NULL,
      ResponseSizeBytes BIGINT NULL,
      RedirectCount INT NULL,
      FinalUrl NVARCHAR(2000) NULL,
      ContentCheckResultJson NVARCHAR(MAX) NULL,
      ErrorCode VARCHAR(50) NULL,
      ErrorMessage NVARCHAR(1000) NULL
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SslCertificateRecords' AND xtype='U')
    CREATE TABLE SslCertificateRecords (
      MonitorId INT PRIMARY KEY REFERENCES Monitors(Id) ON DELETE CASCADE,
      Domain NVARCHAR(300) NULL,
      Issuer NVARCHAR(500) NULL,
      Subject NVARCHAR(500) NULL,
      ValidFrom DATETIME2 NULL,
      ExpiresAt DATETIME2 NULL,
      HostnameMatch BIT NULL,
      ChainValid BIT NULL,
      SelfSigned BIT NULL,
      TlsProtocol VARCHAR(20) NULL,
      SignatureAlgorithm VARCHAR(100) NULL,
      LastCheckedAt DATETIME2 NULL,
      LastAlertThresholdDays INT NULL
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Incidents' AND xtype='U')
    CREATE TABLE Incidents (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      MonitorId INT NOT NULL REFERENCES Monitors(Id),
      Title NVARCHAR(300) NOT NULL,
      Severity VARCHAR(20) NOT NULL DEFAULT 'Medium',
      Status VARCHAR(20) NOT NULL DEFAULT 'Open',
      FailureReason NVARCHAR(500) NULL,
      HttpStatusCode INT NULL,
      StartedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      ResolvedAt DATETIME2 NULL,
      DowntimeSeconds INT NULL,
      CONSTRAINT CK_Incidents_Severity CHECK (Severity IN ('Low','Medium','High','Critical')),
      CONSTRAINT CK_Incidents_Status CHECK (Status IN ('Open','Investigating','Identified','Monitoring','Resolved','Closed'))
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AlertContacts' AND xtype='U')
    CREATE TABLE AlertContacts (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(200) NOT NULL,
      ContactType VARCHAR(20) NOT NULL DEFAULT 'Email',
      Destination NVARCHAR(500) NOT NULL,
      VerificationStatus VARCHAR(20) NOT NULL DEFAULT 'Unverified',
      IsActive BIT NOT NULL DEFAULT 1,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_AlertContacts_Type CHECK (ContactType IN ('Email','Slack','Teams','Webhook','InApp'))
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AlertPolicies' AND xtype='U')
    CREATE TABLE AlertPolicies (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(200) NOT NULL,
      IsDefault BIT NOT NULL DEFAULT 0,
      NotifyOnDown BIT NOT NULL DEFAULT 1,
      NotifyOnRecovery BIT NOT NULL DEFAULT 1,
      NotifyOnDegraded BIT NOT NULL DEFAULT 0,
      NotifyOnSslExpiring BIT NOT NULL DEFAULT 1,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AlertPolicyContacts' AND xtype='U')
    CREATE TABLE AlertPolicyContacts (
      AlertPolicyId INT NOT NULL REFERENCES AlertPolicies(Id) ON DELETE CASCADE,
      AlertContactId INT NOT NULL REFERENCES AlertContacts(Id) ON DELETE CASCADE,
      PRIMARY KEY (AlertPolicyId, AlertContactId)
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='NotificationLogs' AND xtype='U')
    CREATE TABLE NotificationLogs (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      EventType VARCHAR(40) NOT NULL,
      MonitorId INT NULL,
      IncidentId INT NULL,
      AlertContactId INT NULL,
      Subject NVARCHAR(300) NULL,
      Provider VARCHAR(20) NOT NULL DEFAULT 'Email',
      Status VARCHAR(20) NOT NULL DEFAULT 'Pending',
      SentAt DATETIME2 NULL,
      FailureReason NVARCHAR(500) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MonitoringSettings' AND xtype='U')
    CREATE TABLE MonitoringSettings (
      Id INT NOT NULL DEFAULT 1,
      DefaultIntervalSeconds INT NOT NULL DEFAULT 300,
      DefaultTimeoutMs INT NOT NULL DEFAULT 10000,
      DefaultFailureConfirmCount INT NOT NULL DEFAULT 2,
      DefaultRecoveryConfirmCount INT NOT NULL DEFAULT 1,
      DefaultResponseWarningMs INT NOT NULL DEFAULT 1000,
      DefaultResponseCriticalMs INT NOT NULL DEFAULT 3000,
      DefaultAlertPolicyId INT NULL,
      DataRetentionDays INT NOT NULL DEFAULT 90,
      MaxResponseSizeBytes BIGINT NOT NULL DEFAULT 26214400,
      DefaultUserAgent NVARCHAR(300) NOT NULL DEFAULT 'LogMonitor-WebsiteMonitor/1.0',
      BlockPrivateNetworks BIT NOT NULL DEFAULT 1,
      MaxRedirects INT NOT NULL DEFAULT 5,
      CONSTRAINT PK_MonitoringSettings PRIMARY KEY (Id),
      CONSTRAINT CK_MonitoringSettings_Singleton CHECK (Id = 1)
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Monitors_NextCheckAt')
    CREATE INDEX IX_Monitors_NextCheckAt ON Monitors (MonitorType, IsActive, NextCheckAt)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_MonitorResults_MonitorId_CheckedAt')
    CREATE INDEX IX_MonitorResults_MonitorId_CheckedAt ON MonitorResults (MonitorId, CheckedAt DESC)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Incidents_MonitorId_Status')
    CREATE INDEX IX_Incidents_MonitorId_Status ON Incidents (MonitorId, Status)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_NotificationLogs_CreatedAt')
    CREATE INDEX IX_NotificationLogs_CreatedAt ON NotificationLogs (CreatedAt DESC)
  `;

  // Seed: singleton settings row + default alert policy.
  await db.query`
    IF NOT EXISTS (SELECT * FROM MonitoringSettings WHERE Id = 1)
    INSERT INTO MonitoringSettings (Id) VALUES (1)
  `;

  const defaultPolicy = await db.query<{ Cnt: number }>("SELECT COUNT(*) AS Cnt FROM AlertPolicies WHERE IsDefault = 1");
  if (defaultPolicy.recordset[0].Cnt === 0) {
    await db.query`INSERT INTO AlertPolicies (Name, IsDefault) VALUES ('Default Policy', 1)`;
  }

  console.log("Website & API Monitoring schema ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
