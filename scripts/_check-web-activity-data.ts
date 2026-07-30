import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  const staffCount = await db.query("SELECT COUNT(*) AS Cnt FROM Staff WHERE MacAddress IS NOT NULL");
  console.log("Staff with MacAddress:", JSON.stringify(staffCount.recordset[0]));

  const rcCount = await db.query("SELECT COUNT(*) AS Cnt FROM RouterClients");
  const scCount = await db.query("SELECT COUNT(*) AS Cnt FROM SophosClients");
  console.log("RouterClients rows:", JSON.stringify(rcCount.recordset[0]));
  console.log("SophosClients rows:", JSON.stringify(scCount.recordset[0]));

  const rwlCount = await db.query("SELECT COUNT(*) AS Cnt, MAX(ReceivedAt) AS MostRecent FROM RouterWebLogs");
  console.log("RouterWebLogs rows:", JSON.stringify(rwlCount.recordset[0]));

  const staffIps = await db.query(`
    SELECT s.Id, s.Name, s.MacAddress, rc.IpAddress AS RcIp, sc.IpAddress AS ScIp
    FROM Staff s
    LEFT JOIN RouterClients rc ON UPPER(rc.MacAddress) = UPPER(s.MacAddress)
    LEFT JOIN SophosClients sc ON UPPER(sc.MacAddress) = UPPER(s.MacAddress)
    WHERE s.MacAddress IS NOT NULL
  `);
  console.log("Staff -> IP resolution:", JSON.stringify(staffIps.recordset, null, 1));

  const combined = await db.query(`
    WITH StaffIps AS (
      SELECT s.Id AS StaffId, s.Name AS StaffName, rc.IpAddress
      FROM Staff s JOIN RouterClients rc ON UPPER(rc.MacAddress) = UPPER(s.MacAddress)
      WHERE s.MacAddress IS NOT NULL
      UNION
      SELECT s.Id AS StaffId, s.Name AS StaffName, sc.IpAddress
      FROM Staff s JOIN SophosClients sc ON UPPER(sc.MacAddress) = UPPER(s.MacAddress)
      WHERE s.MacAddress IS NOT NULL
    )
    SELECT COUNT(*) AS Cnt FROM RouterWebLogs rwl JOIN StaffIps si ON si.IpAddress = rwl.SrcIp
  `);
  console.log("Combined page total rows:", JSON.stringify(combined.recordset[0]));

  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
