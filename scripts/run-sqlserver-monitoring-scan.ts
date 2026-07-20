import "dotenv/config";
import { runSqlServerMonitoringPass } from "../src/lib/sqlServerMonitoring/collector";

async function main() {
  const results = await runSqlServerMonitoringPass();
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] SQL Server monitoring pass complete across ${results.length} instance(s)`);
  for (const r of results) {
    console.log(`  - ${r.instanceName}: ${r.status} - ${r.message}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("SQL Server monitoring pass failed:", err);
  process.exit(1);
});
