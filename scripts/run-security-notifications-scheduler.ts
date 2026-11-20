import "dotenv/config";
import { processSecurityAlertEscalations, sendDigestIfDue } from "../src/lib/intrusionDetection/notificationChannels";

// Meant to run every few minutes via a scheduled task (mirrors how
// scripts/run-website-api-monitoring-scan.ts drives that module's own escalation pass) - both
// functions are no-ops unless their respective setting is enabled, and both are safe to call
// repeatedly (escalation steps and the digest each dedupe themselves).
async function main() {
  await processSecurityAlertEscalations();
  await sendDigestIfDue();
  console.log("Security notifications scheduler pass complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
