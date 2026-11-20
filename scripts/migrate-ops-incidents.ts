import "dotenv/config";
import { getDb } from "../src/lib/db";

// General, source-agnostic incident management - deliberately a new table rather than
// extending the existing website-monitoring `Incidents` table (which has a hard NOT NULL FK
// to Monitors, used by 3 other modules' escalation/notification pipelines - loosening that
// would conflate "a website went down" with "a general ops incident" in one status enum). An
// OpsIncident can link to N SecurityAlerts and/or N website-monitoring Incidents, or be fully
// manual with no links at all - "Create incident from one or more alerts, or manually."
// Severity/Status values mirror the existing Incidents table's own enum for consistency across
// the app's two incident concepts, even though they're separate tables.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OpsIncidents' AND xtype='U')
    CREATE TABLE OpsIncidents (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Title NVARCHAR(300) NOT NULL,
      Severity VARCHAR(20) NOT NULL DEFAULT 'Medium',
      AffectedSystem NVARCHAR(300) NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'Open',
      OwnerUserId INT NULL,
      StartedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      AcknowledgedAt DATETIME2 NULL,
      AcknowledgedByUserId INT NULL,
      ResolvedAt DATETIME2 NULL,
      ResolvedByUserId INT NULL,
      RootCause NVARCHAR(MAX) NULL,
      Fix NVARCHAR(MAX) NULL,
      Prevention NVARCHAR(MAX) NULL,
      CreatedByUserId INT NULL,
      CreatedByUsername NVARCHAR(100) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_OpsIncidents_Status_StartedAt' AND object_id = OBJECT_ID('OpsIncidents'))
    CREATE INDEX IX_OpsIncidents_Status_StartedAt ON OpsIncidents(Status, StartedAt DESC)
  `;

  // Join tables - an incident can link to any number of alerts/monitor-incidents, and the same
  // alert/monitor-incident could in principle be referenced by more than one OpsIncident (e.g.
  // a follow-up incident reopened later), so these are plain many-to-many tables, not a
  // single nullable FK column on SecurityAlerts/Incidents.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OpsIncidentSecurityAlerts' AND xtype='U')
    CREATE TABLE OpsIncidentSecurityAlerts (
      IncidentId INT NOT NULL REFERENCES OpsIncidents(Id) ON DELETE CASCADE,
      AlertId INT NOT NULL REFERENCES SecurityAlerts(Id) ON DELETE CASCADE,
      PRIMARY KEY (IncidentId, AlertId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OpsIncidentMonitorIncidents' AND xtype='U')
    CREATE TABLE OpsIncidentMonitorIncidents (
      IncidentId INT NOT NULL REFERENCES OpsIncidents(Id) ON DELETE CASCADE,
      MonitorIncidentId INT NOT NULL REFERENCES Incidents(Id) ON DELETE CASCADE,
      PRIMARY KEY (IncidentId, MonitorIncidentId)
    )
  `;

  // Automatic entries (status/owner changes, alert links, KB actions) and manual notes share
  // one table/timeline, same reasoning as every other "one combined log" pattern in this app
  // (SecurityAlertStatusHistory, NotificationLogs) - UserId/Username NULL on a pure-system entry.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OpsIncidentTimeline' AND xtype='U')
    CREATE TABLE OpsIncidentTimeline (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      IncidentId INT NOT NULL REFERENCES OpsIncidents(Id) ON DELETE CASCADE,
      EntryType VARCHAR(30) NOT NULL,
      Message NVARCHAR(2000) NOT NULL,
      UserId INT NULL,
      Username NVARCHAR(100) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_OpsIncidentTimeline_IncidentId_CreatedAt' AND object_id = OBJECT_ID('OpsIncidentTimeline'))
    CREATE INDEX IX_OpsIncidentTimeline_IncidentId_CreatedAt ON OpsIncidentTimeline(IncidentId, CreatedAt ASC)
  `;

  // Same storage convention as KnowledgeBaseDocuments - outside the web root, UUID filename on
  // disk, only ever reachable via an authenticated download route (see opsIncidents/attachments.ts).
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OpsIncidentAttachments' AND xtype='U')
    CREATE TABLE OpsIncidentAttachments (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      IncidentId INT NOT NULL REFERENCES OpsIncidents(Id) ON DELETE CASCADE,
      FilePath NVARCHAR(500) NOT NULL,
      OriginalFileName NVARCHAR(255) NOT NULL,
      ContentType NVARCHAR(150) NULL,
      SizeBytes INT NOT NULL,
      UploadedByUserId INT NULL,
      UploadedByUsername NVARCHAR(100) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  console.log("Ops Incidents schema (OpsIncidents, OpsIncidentSecurityAlerts, OpsIncidentMonitorIncidents, OpsIncidentTimeline, OpsIncidentAttachments) ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
