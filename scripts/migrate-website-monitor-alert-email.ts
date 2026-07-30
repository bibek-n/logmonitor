import "dotenv/config";
import { getDb } from "../src/lib/db";

// Optional per-monitor override/addition on top of the shared AlertPolicy contact list — lets
// an admin point a single website's Down/Recovered/Degraded/SSL alerts at one or more specific
// addresses (comma-separated, matching sendNotificationEmail's existing multi-recipient "to"
// convention) without having to create a whole new AlertContact + AlertPolicy just for one site.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('WebsiteMonitorConfigs') AND name = 'AlertEmail')
    ALTER TABLE WebsiteMonitorConfigs ADD AlertEmail NVARCHAR(1000) NULL
  `;

  console.log("WebsiteMonitorConfigs.AlertEmail column ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
