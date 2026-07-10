import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='NotificationPreferences' AND xtype='U')
    CREATE TABLE NotificationPreferences (
      Id INT NOT NULL PRIMARY KEY,
      EmailEnabled BIT NOT NULL DEFAULT 1,
      SmsEnabled BIT NOT NULL DEFAULT 0,
      PushEnabled BIT NOT NULL DEFAULT 0,
      InAppEnabled BIT NOT NULL DEFAULT 1,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL
    )
  `;
  const prefCount = await db.query`SELECT COUNT(*) AS Cnt FROM NotificationPreferences WHERE Id = 1`;
  if (prefCount.recordset[0].Cnt === 0) {
    await db.query`INSERT INTO NotificationPreferences (Id) VALUES (1)`;
  }

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='NotificationTemplates' AND xtype='U')
    CREATE TABLE NotificationTemplates (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      [Key] NVARCHAR(100) NOT NULL UNIQUE,
      Subject NVARCHAR(300) NULL,
      Body NVARCHAR(MAX) NULL,
      IsSystem BIT NOT NULL DEFAULT 0,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;
  const templateCount = await db.query`SELECT COUNT(*) AS Cnt FROM NotificationTemplates`;
  if (templateCount.recordset[0].Cnt === 0) {
    await db.query`
      INSERT INTO NotificationTemplates ([Key], Subject, Body, IsSystem) VALUES
        ('ticket_created', 'Ticket {{ticketNumber}} received', 'Hi {{name}}, we received your ticket {{ticketNumber}}. We will respond soon.', 1),
        ('ticket_status_changed', 'Ticket {{ticketNumber}} status updated', 'Hi {{name}}, your ticket {{ticketNumber}} status is now: {{status}}.', 1),
        ('ticket_reply', 'New reply on ticket {{ticketNumber}}', 'Hi {{name}}, you have a new reply on ticket {{ticketNumber}}:\n\n{{message}}', 1)
    `;
    console.log("Seeded default NotificationTemplates.");
  }

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='NotificationRules' AND xtype='U')
    CREATE TABLE NotificationRules (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      EventName NVARCHAR(100) NOT NULL UNIQUE,
      EmailEnabled BIT NOT NULL DEFAULT 1,
      SmsEnabled BIT NOT NULL DEFAULT 0,
      PushEnabled BIT NOT NULL DEFAULT 0,
      InAppEnabled BIT NOT NULL DEFAULT 1,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;
  const ruleCount = await db.query`SELECT COUNT(*) AS Cnt FROM NotificationRules`;
  if (ruleCount.recordset[0].Cnt === 0) {
    await db.query`
      INSERT INTO NotificationRules (EventName, EmailEnabled, InAppEnabled) VALUES
        ('ticket_created', 1, 1),
        ('ticket_status_changed', 1, 1),
        ('ticket_reply', 1, 1),
        ('contact_message_received', 1, 1)
    `;
    console.log("Seeded default NotificationRules.");
  }

  console.log("Notification tables (NotificationPreferences, NotificationTemplates, NotificationRules) ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
