import "dotenv/config";
import { runDueSchedules } from "../src/lib/securityUpdates/installs";

// Security & Updates: queue installs for schedules that are due. Run every ~5 minutes by the
// "LogMonitor Update Schedules" scheduled task (scripts/run-update-schedules.ps1).
// Safe to overlap: each schedule is claimed atomically before anything is queued.
async function main() {
  const r = await runDueSchedules();
  console.log(`[${new Date().toISOString()}] update schedules: ${r.schedules} due, ${r.queued} device(s) queued, ${r.skipped} skipped`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
