import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

// SQL Server instance monitoring - registered instances (starting with this app's own
// database, seeded below with IsSelfMonitoring=1 so it needs no stored credentials and is
// testable immediately) each get a live-health snapshot every collection pass, plus
// separate small tables for the three "event list" metrics (deadlocks/blocking/slow
// queries) that don't fit a single scalar row. Everything is collected via SQL Server's own
// system DMVs (sys.dm_os_*, sys.dm_exec_*) and the built-in system_health Extended Events
// session - no paid tooling, no Query Store dependency (not always enabled), works on every
// supported SQL Server edition including Express.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SqlServerInstances' AND xtype='U')
    CREATE TABLE SqlServerInstances (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(200) NOT NULL,
      HostName NVARCHAR(255) NOT NULL,
      Port INT NOT NULL DEFAULT 1433,
      AuthType VARCHAR(20) NOT NULL DEFAULT 'sql',
      SqlUsername NVARCHAR(200) NULL,
      SqlPasswordEncrypted NVARCHAR(500) NULL,
      IsSelfMonitoring BIT NOT NULL DEFAULT 0,
      Enabled BIT NOT NULL DEFAULT 1,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      LastCheckAt DATETIME2 NULL,
      LastCheckStatus VARCHAR(20) NULL,
      LastErrorMessage NVARCHAR(1000) NULL,
      CONSTRAINT CK_SqlServerInstances_AuthType CHECK (AuthType IN ('sql','windows'))
    )
  `;

  // One row per collection pass per instance - the scalar "live health" metrics.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SqlServerMetricsSnapshots' AND xtype='U')
    CREATE TABLE SqlServerMetricsSnapshots (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY,
      InstanceId INT NOT NULL,
      ReceivedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      IsAvailable BIT NOT NULL,
      CpuPct FLOAT NULL,
      MemoryUsedMB FLOAT NULL,
      MemoryTargetMB FLOAT NULL,
      BufferCacheHitRatio FLOAT NULL,
      PageLifeExpectancy INT NULL,
      ActiveSessionCount INT NULL,
      BlockingSessionCount INT NULL,
      DeadlockCountCumulative BIGINT NULL,
      CONSTRAINT FK_SqlServerMetricsSnapshots_Instance FOREIGN KEY (InstanceId) REFERENCES SqlServerInstances(Id)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SqlServerMetricsSnapshots_InstanceId_ReceivedAt')
    CREATE INDEX IX_SqlServerMetricsSnapshots_InstanceId_ReceivedAt ON SqlServerMetricsSnapshots (InstanceId, ReceivedAt DESC)
  `;

  // Latest-snapshot-per-database (delete-then-insert per pass, same pattern as DeviceDisks) -
  // covers availability, size, log usage, and last backup in one row per database.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SqlServerDatabaseSnapshots' AND xtype='U')
    CREATE TABLE SqlServerDatabaseSnapshots (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      InstanceId INT NOT NULL,
      DatabaseName NVARCHAR(200) NOT NULL,
      StateDesc VARCHAR(30) NOT NULL,
      RecoveryModel VARCHAR(20) NULL,
      DataSizeMB FLOAT NULL,
      LogSizeMB FLOAT NULL,
      LogUsedPercent FLOAT NULL,
      LastBackupAt DATETIME2 NULL,
      LastBackupType VARCHAR(10) NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_SqlServerDatabaseSnapshots_Instance FOREIGN KEY (InstanceId) REFERENCES SqlServerInstances(Id)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SqlServerDatabaseSnapshots_InstanceId')
    CREATE INDEX IX_SqlServerDatabaseSnapshots_InstanceId ON SqlServerDatabaseSnapshots (InstanceId)
  `;

  // Sourced from the built-in system_health Extended Events ring buffer - no custom XE
  // session needs to be created, it's on by default on every SQL Server instance.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SqlServerDeadlockEvents' AND xtype='U')
    CREATE TABLE SqlServerDeadlockEvents (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY,
      InstanceId INT NOT NULL,
      DetectedAt DATETIME2 NOT NULL,
      Summary NVARCHAR(1000) NULL,
      DeadlockGraphXml NVARCHAR(MAX) NULL,
      ReceivedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_SqlServerDeadlockEvents_Instance FOREIGN KEY (InstanceId) REFERENCES SqlServerInstances(Id)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SqlServerDeadlockEvents_InstanceId_DetectedAt')
    CREATE INDEX IX_SqlServerDeadlockEvents_InstanceId_DetectedAt ON SqlServerDeadlockEvents (InstanceId, DetectedAt DESC)
  `;

  // Point-in-time snapshots of sys.dm_exec_requests WHERE blocking_session_id <> 0, taken
  // once per collection pass - a real limit of poll-based (not continuous trace) monitoring
  // is that blocking shorter than the poll interval can be missed. Documented, not hidden.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SqlServerBlockingEvents' AND xtype='U')
    CREATE TABLE SqlServerBlockingEvents (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY,
      InstanceId INT NOT NULL,
      DetectedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      BlockedSessionId INT NOT NULL,
      BlockingSessionId INT NOT NULL,
      WaitTimeMs INT NULL,
      WaitType NVARCHAR(100) NULL,
      DatabaseName NVARCHAR(200) NULL,
      BlockedQueryText NVARCHAR(2000) NULL,
      CONSTRAINT FK_SqlServerBlockingEvents_Instance FOREIGN KEY (InstanceId) REFERENCES SqlServerInstances(Id)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SqlServerBlockingEvents_InstanceId_DetectedAt')
    CREATE INDEX IX_SqlServerBlockingEvents_InstanceId_DetectedAt ON SqlServerBlockingEvents (InstanceId, DetectedAt DESC)
  `;

  // Top-N-by-avg-duration snapshot from sys.dm_exec_query_stats each pass (cumulative since
  // last plan cache flush/restart, not "recently run" - a known characteristic of this DMV,
  // not a bug). Deliberately not Query-Store-based since Query Store isn't always enabled.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SqlServerSlowQueries' AND xtype='U')
    CREATE TABLE SqlServerSlowQueries (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY,
      InstanceId INT NOT NULL,
      DetectedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      DatabaseName NVARCHAR(200) NULL,
      QueryText NVARCHAR(MAX) NULL,
      AvgDurationMs FLOAT NOT NULL,
      ExecutionCount BIGINT NOT NULL,
      LastExecutedAt DATETIME2 NULL,
      CONSTRAINT FK_SqlServerSlowQueries_Instance FOREIGN KEY (InstanceId) REFERENCES SqlServerInstances(Id)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SqlServerSlowQueries_InstanceId_DetectedAt')
    CREATE INDEX IX_SqlServerSlowQueries_InstanceId_DetectedAt ON SqlServerSlowQueries (InstanceId, DetectedAt DESC)
  `;

  // Seed this app's own database as the first, zero-config, immediately-testable instance -
  // IsSelfMonitoring=1 means the collector reuses the app's existing DB connection pool
  // rather than needing separately stored credentials.
  await db.query`
    IF NOT EXISTS (SELECT * FROM SqlServerInstances WHERE IsSelfMonitoring = 1)
    INSERT INTO SqlServerInstances (Name, HostName, Port, AuthType, IsSelfMonitoring, Enabled)
    VALUES ('LogMonitor Database (this app)', 'self', 1433, 'sql', 1, 1)
  `;

  console.log("SQL Server Monitoring schema ready, self-monitoring instance seeded.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
