import "dotenv/config";
import { runDueWordPressScanSchedules } from "../src/lib/wordpressScan/schedules";

// WordPress Deep Scan: run schedules that are due. Run every ~10-15 minutes by the
// "LogMonitor WordPress Scan Schedules" scheduled task (scripts/run-wordpress-scan-schedules.ps1).
// Safe to overlap: each schedule is claimed atomically before its scan runs.
async function main() {
  const r = await runDueWordPressScanSchedules();
  console.log(`[${new Date().toISOString()}] wordpress scan schedules: ${r.due} due, ${r.scanned} scanned, ${r.skipped} skipped`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
