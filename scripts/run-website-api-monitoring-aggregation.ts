import "dotenv/config";
import { runAggregation, pruneOldAggregates } from "../src/lib/websiteApiMonitoring/aggregation";

// Separate, less-frequent scheduled job from the per-minute check scan
// (run-website-api-monitoring-scan.ts) - aggregation only needs to run roughly hourly (each
// bucket isn't even eligible until the hour it covers has fully elapsed), so running it on the
// same tight per-minute schedule as the actual checks would just waste cycles re-checking "is
// anything due yet" 59 times for nothing. Intended to be registered as its own hourly Windows
// Scheduled Task, same convention as every other scheduled job in this app.
async function main() {
  const { hourlyRowsInserted, dailyRowsInserted } = await runAggregation();
  console.log(`Aggregation: ${hourlyRowsInserted} hourly bucket(s), ${dailyRowsInserted} daily bucket(s) written.`);

  const pruned = await pruneOldAggregates();
  if (pruned > 0) console.log(`Pruned ${pruned} aggregate row(s) past the aggregate retention window.`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
