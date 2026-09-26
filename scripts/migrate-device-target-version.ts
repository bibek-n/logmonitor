import "dotenv/config";
import { getDb } from "../src/lib/db";

// Per-device agent target version (staged rollout to ONE machine). When set, the heartbeat hands THIS device that release
// tag instead of the Employee/Server target from Agent Rollout Settings. NULL = follow the normal rollout. Idempotent.
async function main() {
  const db = await getDb();
  const exists = await db.query("SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Devices') AND name = 'AgentTargetVersion'");
  if (exists.recordset.length > 0) {
    console.log("Devices.AgentTargetVersion already exists - skipping");
  } else {
    await db.query("ALTER TABLE Devices ADD AgentTargetVersion VARCHAR(40) NULL");
    console.log("Added Devices.AgentTargetVersion");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
