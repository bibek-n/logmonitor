import "dotenv/config";
import { computeSecurityScore, getComponentCounts } from "../src/lib/securityCenter/securityScore";
import { insertScoreSnapshot } from "../src/lib/securityCenter/repository";

// Feeds the Dashboard's Security Trend Graph - one snapshot per run, no historical backfill
// (only real, going-forward data). Registered as an hourly Windows Scheduled Task.
async function main() {
  const counts = await getComponentCounts();
  const { overallScore, componentScores } = computeSecurityScore(counts);
  await insertScoreSnapshot(overallScore, componentScores);
  console.log(`Security Center score snapshot recorded: overall=${overallScore}`, componentScores);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
