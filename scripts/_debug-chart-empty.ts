import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

async function main() {
  const db = await getDb();

  const staffList = [
    ["Sanjeeb Bade", 2],
    ["Sabina Shrestha", 12],
    ["Anish Maharjan", 13],
  ] as const;

  for (const [name, staffId] of staffList) {
    console.log(`\n=== ${name} (Staff.Id=${staffId}) ===`);
    const staff = await db.request().input("id", sql.Int, staffId).query("SELECT MacAddress FROM Staff WHERE Id = @id");
    const mac = staff.recordset[0]?.MacAddress;
    console.log("MAC:", mac);
    if (!mac) continue;

    const historyResult = await db
      .request()
      .input("mac", sql.VarChar, mac)
      .query(`
        SELECT IpAddress, 'mikrotik' AS Source FROM RouterClients WHERE UPPER(MacAddress) = UPPER(@mac)
        UNION ALL
        SELECT IpAddress, 'sophos' AS Source FROM SophosClients WHERE UPPER(MacAddress) = UPPER(@mac)
      `);
    const allIps = [...new Set(historyResult.recordset.map((h: { IpAddress: string }) => h.IpAddress))];
    console.log("IPs:", JSON.stringify(allIps));
    if (allIps.length === 0) continue;

    const ipList = allIps.map((_, i) => `@ip${i}`).join(", ");
    const req = db.request();
    allIps.forEach((ip, i) => req.input(`ip${i}`, sql.VarChar, ip));

    const totalAllTime = await req.query(`SELECT COUNT(*) AS Cnt, MAX(ReceivedAt) AS MostRecent FROM WebFilterLogs WHERE SrcIp IN (${ipList})`);
    console.log("All-time WebFilterLogs count for these IPs:", JSON.stringify(totalAllTime.recordset[0]));

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const req2 = db.request().input("since", sql.DateTime2, since);
    allIps.forEach((ip, i) => req2.input(`ip${i}`, sql.VarChar, ip));
    const last30 = await req2.query(`SELECT COUNT(*) AS Cnt FROM WebFilterLogs WHERE SrcIp IN (${ipList}) AND ReceivedAt >= @since`);
    console.log("Last-30-days WebFilterLogs count for these IPs:", JSON.stringify(last30.recordset[0]), "since=", since.toISOString());
  }

  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
