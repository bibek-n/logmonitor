import "dotenv/config";
import { runCollectionPass } from "../src/lib/intrusionDetection/collector";

// Entry point for the background worker - matches this app's established poller pattern
// (syslog/poll-router-clients.ts, syslog/poll-sophos-clients.ts): a `dotenv/config` + loop
// script run as its own Windows Scheduled Task, not a long-lived server process. Runs one
// collection pass (every enabled log source) and exits, so the Scheduled Task's own
// interval controls the cadence rather than an in-process setInterval.
async function main() {
  const startedAt = Date.now();
  const summaries = await runCollectionPass();

  const totalEvents = summaries.reduce((sum, s) => sum + s.eventsProcessed, 0);
  const totalAlerts = summaries.reduce((sum, s) => sum + s.alertsCreated, 0);

  console.log(`[${new Date().toISOString()}] Intrusion detection collection pass complete in ${Date.now() - startedAt}ms`);
  for (const s of summaries) {
    console.log(`  - ${s.logSourceName}: ${s.status} - ${s.message}`);
  }
  console.log(`  Total: ${totalEvents} event(s), ${totalAlerts} alert(s) created/updated across ${summaries.length} log source(s).`);

  process.exit(0);
}

main().catch((err) => {
  console.error(`[${new Date().toISOString()}] Intrusion detection collection pass failed:`, err);
  process.exit(1);
});
