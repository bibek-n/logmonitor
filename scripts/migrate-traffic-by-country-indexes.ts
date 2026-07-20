import "dotenv/config";
import { getDb } from "../src/lib/db";

// The dashboard's Traffic by Country widget (src/lib/trafficByCountry.ts) groups the last
// 24h of RouterWebLogs/WebFilterLogs by DstIp - at real traffic volume (hundreds of
// thousands of rows/day) that scan timed out against the default 15s request timeout
// without an index covering DstIp.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_RouterWebLogs_DstIp_ReceivedAt')
    CREATE INDEX IX_RouterWebLogs_DstIp_ReceivedAt ON RouterWebLogs (DstIp, ReceivedAt DESC)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WebFilterLogs_DstIp_ReceivedAt')
    CREATE INDEX IX_WebFilterLogs_DstIp_ReceivedAt ON WebFilterLogs (DstIp, ReceivedAt DESC)
  `;

  console.log("Traffic-by-country indexes ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
