import "dotenv/config";
import { getDb } from "../src/lib/db";

// Phase 3: Slack/Teams/Webhook/In-app alert channels, escalation steps, quiet hours,
// Maintenance Windows, the full interactive incident workflow, and notification retry.
// All additive - existing Email-only alerting and the auto-open/auto-resolve incident flow
// keep working unchanged for anyone who never touches the new fields/tables.
async function main() {
  const db = await getDb();

  // AlertContacts gets a small JSON blob for channel-specific extras (e.g. a webhook signing
  // secret or custom header) that doesn't fit the existing single Destination string - kept
  // optional/nullable so every existing Email contact is unaffected.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AlertContacts') AND name = 'ConfigJson')
    ALTER TABLE AlertContacts ADD ConfigJson NVARCHAR(1000) NULL
  `;

  // Quiet hours + escalation are per-policy, not global - a policy with EscalationEnabled=0
  // and QuietHoursEnabled=0 (the default) behaves exactly like it does today.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AlertPolicies') AND name = 'QuietHoursEnabled')
    ALTER TABLE AlertPolicies ADD QuietHoursEnabled BIT NOT NULL DEFAULT 0
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AlertPolicies') AND name = 'QuietHoursStart')
    ALTER TABLE AlertPolicies ADD QuietHoursStart VARCHAR(5) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AlertPolicies') AND name = 'QuietHoursEnd')
    ALTER TABLE AlertPolicies ADD QuietHoursEnd VARCHAR(5) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AlertPolicies') AND name = 'QuietHoursTimezone')
    ALTER TABLE AlertPolicies ADD QuietHoursTimezone VARCHAR(50) NOT NULL DEFAULT 'UTC'
  `;
  // A Critical-severity incident (i.e. a Down event, not a Degraded/SSL-expiring one) still
  // pages through quiet hours by default - the point of quiet hours is muting noise, not
  // muting real outages.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AlertPolicies') AND name = 'QuietHoursAllowCritical')
    ALTER TABLE AlertPolicies ADD QuietHoursAllowCritical BIT NOT NULL DEFAULT 1
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AlertPolicies') AND name = 'EscalationEnabled')
    ALTER TABLE AlertPolicies ADD EscalationEnabled BIT NOT NULL DEFAULT 0
  `;

  // Escalation steps are *additional* notification rounds beyond the immediate one
  // (AlertPolicyContacts, unchanged) - step 1 fires DelayMinutes after the incident opened if
  // still unacknowledged, step 2 fires DelayMinutes after step 1, etc.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AlertEscalationSteps' AND xtype='U')
    CREATE TABLE AlertEscalationSteps (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      AlertPolicyId INT NOT NULL REFERENCES AlertPolicies(Id) ON DELETE CASCADE,
      StepOrder INT NOT NULL,
      DelayMinutes INT NOT NULL DEFAULT 15,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AlertEscalationStepContacts' AND xtype='U')
    CREATE TABLE AlertEscalationStepContacts (
      StepId INT NOT NULL REFERENCES AlertEscalationSteps(Id) ON DELETE CASCADE,
      AlertContactId INT NOT NULL REFERENCES AlertContacts(Id) ON DELETE CASCADE,
      PRIMARY KEY (StepId, AlertContactId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AlertEscalationSteps_PolicyId_Order' AND object_id = OBJECT_ID('AlertEscalationSteps'))
    CREATE INDEX IX_AlertEscalationSteps_PolicyId_Order ON AlertEscalationSteps(AlertPolicyId, StepOrder)
  `;

  // Which escalation steps have already fired for a given incident - without this, a scan
  // running every minute would re-fire every past-due step on every pass instead of once each.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='IncidentEscalations' AND xtype='U')
    CREATE TABLE IncidentEscalations (
      IncidentId INT NOT NULL REFERENCES Incidents(Id) ON DELETE CASCADE,
      StepId INT NOT NULL REFERENCES AlertEscalationSteps(Id) ON DELETE CASCADE,
      FiredAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      PRIMARY KEY (IncidentId, StepId)
    )
  `;

  // Maintenance Windows - a monitor inside an active window gets Status='Maintenance' (already
  // a valid value per the original CK_Monitors_Status constraint), its checks are skipped, and
  // its alerts are suppressed for the duration.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MaintenanceWindows' AND xtype='U')
    CREATE TABLE MaintenanceWindows (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(200) NOT NULL,
      Description NVARCHAR(1000) NULL,
      StartsAt DATETIME2 NOT NULL,
      EndsAt DATETIME2 NOT NULL,
      IsRecurring BIT NOT NULL DEFAULT 0,
      RecurrenceRule VARCHAR(20) NULL,
      IsActive BIT NOT NULL DEFAULT 1,
      CreatedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_MaintenanceWindows_Recurrence CHECK (RecurrenceRule IS NULL OR RecurrenceRule IN ('Daily','Weekly','Monthly'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MaintenanceWindowMonitors' AND xtype='U')
    CREATE TABLE MaintenanceWindowMonitors (
      MaintenanceWindowId INT NOT NULL REFERENCES MaintenanceWindows(Id) ON DELETE CASCADE,
      MonitorId INT NOT NULL REFERENCES Monitors(Id) ON DELETE CASCADE,
      PRIMARY KEY (MaintenanceWindowId, MonitorId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_MaintenanceWindows_Active_Window' AND object_id = OBJECT_ID('MaintenanceWindows'))
    CREATE INDEX IX_MaintenanceWindows_Active_Window ON MaintenanceWindows(IsActive, StartsAt, EndsAt)
  `;

  // Incident workflow: acknowledge/assign, matching the existing StartedAt/ResolvedAt
  // convention (a plain timestamp + who, not a separate history table for these two).
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Incidents') AND name = 'AssignedToUserId')
    ALTER TABLE Incidents ADD AssignedToUserId INT NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Incidents') AND name = 'AcknowledgedAt')
    ALTER TABLE Incidents ADD AcknowledgedAt DATETIME2 NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Incidents') AND name = 'AcknowledgedByUserId')
    ALTER TABLE Incidents ADD AcknowledgedByUserId INT NULL
  `;

  // Freeform notes are a running log, unlike acknowledge/assign - a dedicated table, same
  // shape as every other "one row per event" log in this module (NotificationLogs, etc.).
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='IncidentNotes' AND xtype='U')
    CREATE TABLE IncidentNotes (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      IncidentId INT NOT NULL REFERENCES Incidents(Id) ON DELETE CASCADE,
      UserId INT NOT NULL,
      Note NVARCHAR(2000) NOT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  // Notification retry: a Failed row becomes eligible for retry at NextRetryAt, capped by
  // RetryCount - both null/0 by default so every pre-Phase-3 row (and every non-retrying send)
  // is unaffected. Body wasn't previously persisted (only Subject) - without the actual message
  // text, a retry would have nothing to resend, so this is the one genuinely new piece of data
  // every future send now logs alongside Subject; older rows simply have Body=NULL and are
  // skipped by the retry pass rather than resent empty.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('NotificationLogs') AND name = 'Body')
    ALTER TABLE NotificationLogs ADD Body NVARCHAR(MAX) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('NotificationLogs') AND name = 'RetryCount')
    ALTER TABLE NotificationLogs ADD RetryCount INT NOT NULL DEFAULT 0
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('NotificationLogs') AND name = 'NextRetryAt')
    ALTER TABLE NotificationLogs ADD NextRetryAt DATETIME2 NULL
  `;

  // In-app notifications: no existing generic per-admin-user notification system was found
  // anywhere in this app (NotificationRecipients is an email-only address book;
  // EmployeeNotifications is an unrelated admin-to-Staff broadcast system) - this is a new,
  // minimal, read/unread feed keyed to Users.Id, built specifically for the "InApp" AlertContact
  // channel type the schema already reserved a slot for.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='InAppNotifications' AND xtype='U')
    CREATE TABLE InAppNotifications (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      UserId INT NOT NULL,
      EventType VARCHAR(40) NULL,
      Subject NVARCHAR(300) NULL,
      Body NVARCHAR(1000) NULL,
      MonitorId INT NULL,
      IncidentId INT NULL,
      IsRead BIT NOT NULL DEFAULT 0,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_InAppNotifications_UserId_IsRead_CreatedAt' AND object_id = OBJECT_ID('InAppNotifications'))
    CREATE INDEX IX_InAppNotifications_UserId_IsRead_CreatedAt ON InAppNotifications(UserId, IsRead, CreatedAt DESC)
  `;

  console.log("Phase 3 monitoring schema (escalation, quiet hours, maintenance windows, incident workflow, notification retry, in-app notifications) ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
