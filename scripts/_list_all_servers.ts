import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

async function main() {
  const db = await getDb();
  const result = await db.query`
    SELECT DeviceId, DeviceName, Hostname, StaticIpAddress, OS, AgentVersion, LifecycleStatus,
      CONVERT(VARCHAR(19), LastHeartbeat, 126) AS LastHeartbeat
    FROM Devices WHERE DeviceType = 'Server'
    ORDER BY OS ASC, DeviceName ASC
  `;
  console.log(JSON.stringify(result.recordset, null, 2));
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
