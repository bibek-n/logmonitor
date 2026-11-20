import "dotenv/config";
import { getDb } from "../src/lib/db";

// Notifications & Escalation for Security Alerts, mirroring the already-proven design in
// Website/API Monitoring (scripts/migrate-monitoring-phase3.ts: AlertPolicies' quiet-hours
// columns + AlertEscalationSteps/AlertEscalationStepContacts/IncidentEscalations) rather than
// inventing a new shape. The one real difference: alerts aren't grouped under a parent entity
// the way incidents are grouped under Monitors, so there's a single global settings row
// instead of a per-policy one, and escalation steps are global too (not per-policy).
// SecurityNotificationChannels (already exists) plays the AlertContacts role unchanged.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityNotificationSettings' AND xtype='U')
    CREATE TABLE SecurityNotificationSettings (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      QuietHoursEnabled BIT NOT NULL DEFAULT 0,
      QuietHoursStart VARCHAR(5) NULL,
      QuietHoursEnd VARCHAR(5) NULL,
      QuietHoursTimezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
      QuietHoursAllowCritical BIT NOT NULL DEFAULT 1,
      EscalationEnabled BIT NOT NULL DEFAULT 0,
      DigestEnabled BIT NOT NULL DEFAULT 0,
      DigestHour INT NOT NULL DEFAULT 8,
      DigestChannelId INT NULL,
      LastDigestSentAt DATETIME2 NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_SecurityNotificationSettings_DigestChannel FOREIGN KEY (DigestChannelId) REFERENCES SecurityNotificationChannels(Id) ON DELETE SET NULL
    )
  `;
  // Exactly one settings row ever exists - every reader does `SELECT TOP 1 ... ORDER BY Id`,
  // but seeding it up front means the settings UI never has to handle "no row yet".
  await db.query`
    IF NOT EXISTS (SELECT * FROM SecurityNotificationSettings)
    INSERT INTO SecurityNotificationSettings DEFAULT VALUES
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityAlertEscalationSteps' AND xtype='U')
    CREATE TABLE SecurityAlertEscalationSteps (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      StepOrder INT NOT NULL,
      DelayMinutes INT NOT NULL DEFAULT 15,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityAlertEscalationStepChannels' AND xtype='U')
    CREATE TABLE SecurityAlertEscalationStepChannels (
      StepId INT NOT NULL REFERENCES SecurityAlertEscalationSteps(Id) ON DELETE CASCADE,
      ChannelId INT NOT NULL REFERENCES SecurityNotificationChannels(Id) ON DELETE CASCADE,
      PRIMARY KEY (StepId, ChannelId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SecurityAlertEscalationSteps_Order' AND object_id = OBJECT_ID('SecurityAlertEscalationSteps'))
    CREATE INDEX IX_SecurityAlertEscalationSteps_Order ON SecurityAlertEscalationSteps(StepOrder)
  `;

  // Which (alert, step) pairs already fired - without this a scheduler pass every few minutes
  // would re-notify every past-due step on every single pass instead of exactly once each.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecurityAlertEscalations' AND xtype='U')
    CREATE TABLE SecurityAlertEscalations (
      AlertId INT NOT NULL REFERENCES SecurityAlerts(Id) ON DELETE CASCADE,
      StepId INT NOT NULL REFERENCES SecurityAlertEscalationSteps(Id) ON DELETE CASCADE,
      FiredAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      PRIMARY KEY (AlertId, StepId)
    )
  `;

  console.log("Security alert notifications/escalation schema (SecurityNotificationSettings, SecurityAlertEscalationSteps/StepChannels/Escalations) ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
