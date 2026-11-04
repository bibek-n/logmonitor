import "dotenv/config";
import { getDb } from "../src/lib/db";

// Single global Slack/Teams/generic webhook, separate from the per-module email recipient
// table (NotificationRecipients) - this is a delivery CHANNEL (where), not routing (who/what),
// so every notification that already goes out by email can also echo to this one channel
// without needing its own per-module configuration. See src/lib/notifyWebhook.ts.
async function main() {
  const db = await getDb();
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WebhookSettings' AND xtype='U')
    CREATE TABLE WebhookSettings (
      Id INT PRIMARY KEY CHECK (Id = 1),
      Url NVARCHAR(500) NULL,
      Platform VARCHAR(20) NOT NULL DEFAULT 'slack',
      Enabled BIT NOT NULL DEFAULT 0,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL
    )
  `);
  await db.query(`
    IF NOT EXISTS (SELECT * FROM WebhookSettings WHERE Id = 1)
    INSERT INTO WebhookSettings (Id, Url, Platform, Enabled) VALUES (1, NULL, 'slack', 0)
  `);
  console.log("WebhookSettings table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
