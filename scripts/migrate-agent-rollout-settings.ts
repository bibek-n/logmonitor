import "dotenv/config";
import { getDb } from "../src/lib/db";

// Fleet-wide agent rollout target per DeviceType - a singleton row (Id = 1). This table was
// already defined in db/schema.sql, but on a deployment where it hasn't actually been created
// yet, this adds it. No seed row is inserted - both target columns start NULL (no rollout
// approved for either device type), matching the "hold at current version until an admin
// explicitly approves one" gate in agent/update.go's CheckForUpdate. Idempotent.
async function main() {
  const db = await getDb();
  const exists = await db.query("SELECT 1 FROM sys.tables WHERE name = 'AgentRolloutSettings'");
  if (exists.recordset.length > 0) {
    console.log("AgentRolloutSettings already exists - skipping");
  } else {
    await db.query(`
      CREATE TABLE AgentRolloutSettings (
        Id INT NOT NULL PRIMARY KEY,
        EmployeeTargetVersion NVARCHAR(50) NULL,
        ServerTargetVersion NVARCHAR(50) NULL,
        UpdatedByUserId INT NULL,
        UpdatedAt DATETIME2(7) NOT NULL
      )
    `);
    console.log("Created AgentRolloutSettings");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
