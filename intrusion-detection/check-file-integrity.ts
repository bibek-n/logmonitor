import "dotenv/config";
import { checkFileIntegrity } from "../src/lib/intrusionDetection/fileIntegrity";

// Entry point for the file-integrity background worker - same pattern as collect.ts (this
// app's established poller convention: a dotenv/config one-shot script run as its own Windows
// Scheduled Task, cadence controlled by the task's own interval, not an in-process setInterval).
// Re-hashes every SecurityFileIntegrityBaselines row and records/alerts on any drift - see
// src/lib/intrusionDetection/fileIntegrity.ts for the detection logic.
async function main() {
  const startedAt = Date.now();
  const summary = await checkFileIntegrity();

  console.log(`[${new Date().toISOString()}] File integrity check complete in ${Date.now() - startedAt}ms`);
  console.log(`  Checked: ${summary.checked}, unchanged: ${summary.unchanged}, modified: ${summary.modified}, deleted: ${summary.deleted}`);

  process.exit(0);
}

main().catch((err) => {
  console.error(`[${new Date().toISOString()}] File integrity check failed:`, err);
  process.exit(1);
});
