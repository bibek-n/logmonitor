import "dotenv/config";
import { generateAlerts, sendPendingNotificationEmails } from "../src/lib/itAssetLogsheet/alerts";

// Run on a schedule (e.g. every few hours) to both detect new threshold breaches and flush
// any not-yet-emailed notifications as a single digest - see alerts.ts for why
// escalationRecipients/escalationAfterDays aren't wired up yet (no column to track "already
// escalated" without a schema change).
async function main() {
  const { created } = await generateAlerts();
  console.log(`IT Asset alerts: generated ${created} new notification(s).`);

  const { sent } = await sendPendingNotificationEmails();
  console.log(`IT Asset alerts: emailed ${sent} pending notification(s).`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// To run automatically: register a Windows Scheduled Task on the server running
// `npx tsx scripts\run-it-asset-alerts.ts` from D:\WWWROOT\LogMonitor (or use the
// run-it-asset-alerts.ps1 wrapper) - e.g. every 4 hours. Not wired up as part of this change;
// needs to be registered on the server directly, same convention as every other recurring job.
