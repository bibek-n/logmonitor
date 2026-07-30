import "dotenv/config";
import { getDb } from "../src/lib/db";

// Phase 4: metric aggregation (hourly/daily rollups), tiered retention, SLA target/breach
// tracking, and scheduled recurring reports. All additive - existing raw-only retention and
// the on-demand Email Report feature keep working unchanged for anyone who never touches the
// new tables/settings.
async function main() {
  const db = await getDb();

  // One row per monitor per UTC hour/day bucket - built from MonitorResults by the aggregation
  // engine (aggregation.ts), which only ever rolls up a bucket once it's fully in the past (an
  // in-progress hour is never aggregated, so a bucket's numbers never change once written).
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MonitorMetricsHourly' AND xtype='U')
    CREATE TABLE MonitorMetricsHourly (
      MonitorId INT NOT NULL REFERENCES Monitors(Id) ON DELETE CASCADE,
      PeriodStart DATETIME2 NOT NULL,
      TotalChecks INT NOT NULL,
      SuccessfulChecks INT NOT NULL,
      AvgMs FLOAT NULL,
      MinMs INT NULL,
      MaxMs INT NULL,
      P95Ms FLOAT NULL,
      CONSTRAINT PK_MonitorMetricsHourly PRIMARY KEY (MonitorId, PeriodStart)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MonitorMetricsDaily' AND xtype='U')
    CREATE TABLE MonitorMetricsDaily (
      MonitorId INT NOT NULL REFERENCES Monitors(Id) ON DELETE CASCADE,
      PeriodStart DATETIME2 NOT NULL,
      TotalChecks INT NOT NULL,
      SuccessfulChecks INT NOT NULL,
      AvgMs FLOAT NULL,
      MinMs INT NULL,
      MaxMs INT NULL,
      P95Ms FLOAT NULL,
      CONSTRAINT PK_MonitorMetricsDaily PRIMARY KEY (MonitorId, PeriodStart)
    )
  `;

  // Tiered retention: raw MonitorResults still prunes at MonitoringSettings.DataRetentionDays
  // (unchanged), aggregates get their own, much longer, window - the whole point of
  // aggregating is to keep long-run history (for SLA/trend reporting) far past when the raw,
  // per-check rows are worth keeping around.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('MonitoringSettings') AND name = 'AggregateRetentionDays')
    ALTER TABLE MonitoringSettings ADD AggregateRetentionDays INT NOT NULL DEFAULT 730
  `;

  // SLA target/breach: one row per monitor (no row = no SLA tracked for it). LastBreachedPeriodStart
  // dedupes the same way sslEvaluator.ts's LastAlertThresholdDays does - a monitor stuck below
  // target for an entire evaluation window only ever alerts once for that window, not on every
  // scan pass while it stays breached.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SlaConfigurations' AND xtype='U')
    CREATE TABLE SlaConfigurations (
      MonitorId INT NOT NULL PRIMARY KEY REFERENCES Monitors(Id) ON DELETE CASCADE,
      TargetPercent DECIMAL(5,2) NOT NULL DEFAULT 99.9,
      EvaluationWindow VARCHAR(10) NOT NULL DEFAULT 'Monthly',
      LastBreachedPeriodStart DATETIME2 NULL,
      CONSTRAINT CK_SlaConfigurations_Window CHECK (EvaluationWindow IN ('Daily','Weekly','Monthly'))
    )
  `;

  // Scheduled recurring reports - Frequency/NextSendAt drive due-ness (same "script decides
  // what's due" convention every scheduled job in this app already follows), Format decides
  // what gets attached to the report email (Email = body text only, like today's on-demand
  // report; Csv/Pdf/Excel additionally attach a generated file of that type).
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ScheduledReports' AND xtype='U')
    CREATE TABLE ScheduledReports (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(200) NOT NULL,
      Frequency VARCHAR(10) NOT NULL DEFAULT 'Weekly',
      Format VARCHAR(10) NOT NULL DEFAULT 'Email',
      MonitorScope VARCHAR(10) NOT NULL DEFAULT 'All',
      RecipientEmails NVARCHAR(2000) NULL,
      IsActive BIT NOT NULL DEFAULT 1,
      LastSentAt DATETIME2 NULL,
      NextSendAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CreatedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_ScheduledReports_Frequency CHECK (Frequency IN ('Daily','Weekly','Monthly')),
      CONSTRAINT CK_ScheduledReports_Format CHECK (Format IN ('Email','Csv','Pdf','Excel')),
      CONSTRAINT CK_ScheduledReports_Scope CHECK (MonitorScope IN ('All','Selected'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ScheduledReportContacts' AND xtype='U')
    CREATE TABLE ScheduledReportContacts (
      ScheduledReportId INT NOT NULL REFERENCES ScheduledReports(Id) ON DELETE CASCADE,
      AlertContactId INT NOT NULL REFERENCES AlertContacts(Id) ON DELETE CASCADE,
      PRIMARY KEY (ScheduledReportId, AlertContactId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ScheduledReportMonitors' AND xtype='U')
    CREATE TABLE ScheduledReportMonitors (
      ScheduledReportId INT NOT NULL REFERENCES ScheduledReports(Id) ON DELETE CASCADE,
      MonitorId INT NOT NULL REFERENCES Monitors(Id) ON DELETE CASCADE,
      PRIMARY KEY (ScheduledReportId, MonitorId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ScheduledReports_Active_NextSendAt' AND object_id = OBJECT_ID('ScheduledReports'))
    CREATE INDEX IX_ScheduledReports_Active_NextSendAt ON ScheduledReports(IsActive, NextSendAt)
  `;

  console.log("Phase 4 monitoring schema (metric aggregation, SLA tracking, scheduled reports) ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
