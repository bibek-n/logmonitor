import "dotenv/config";
import { computeWeightedSecurityScore } from "../src/lib/securityCenter/securityScore";
import { insertScoreSnapshot } from "../src/lib/securityCenter/repository";
import { checkForScoreDrop } from "../src/lib/securityCenter/scoreDropAlert";

// Feeds the Dashboard's Security Trend Graph - one snapshot per run, no historical backfill
// (only real, going-forward data). Registered as an hourly Windows Scheduled Task. Also checks
// for a significant score drop vs ~24h ago and notifies through the Intrusion Detection
// module's notification channels if so (see scoreDropAlert.ts) - same schedule, no separate task.
async function main() {
  const { overallScore, categories } = await computeWeightedSecurityScore();
  const componentScores = Object.fromEntries(categories.map((c) => [c.key, c.points]));
  await insertScoreSnapshot(overallScore, componentScores);
  console.log(`Security Center score snapshot recorded: overall=${overallScore}`, componentScores);

  await checkForScoreDrop(overallScore);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
