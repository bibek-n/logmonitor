import "dotenv/config";
import { getDb } from "../src/lib/db";

// Read-only: how many checks per hour do the configured intervals require, and how many monitors have multi-region checking on?
async function main() {
  const db = await getDb();
  const iv = await db.query(`SELECT IntervalSeconds, COUNT(*) AS Monitors FROM Monitors WHERE IsActive = 1 AND IsDeleted = 0 AND Status <> 'Maintenance' GROUP BY IntervalSeconds ORDER BY IntervalSeconds`);
  console.log("interval distribution:", JSON.stringify(iv.recordset));
  const need = await db.query(`SELECT CAST(SUM(3600.0 / IntervalSeconds) AS DECIMAL(10,1)) AS RequiredChecksPerHour FROM Monitors WHERE IsActive = 1 AND IsDeleted = 0 AND Status <> 'Maintenance'`);
  console.log("required checks/hour:", JSON.stringify(need.recordset[0]));
  const mr = await db.query(`SELECT MultiRegionCheckEnabled, COUNT(*) AS N FROM WebsiteMonitorConfigs c JOIN Monitors m ON m.Id = c.MonitorId WHERE m.IsActive = 1 AND m.IsDeleted = 0 GROUP BY MultiRegionCheckEnabled`);
  console.log("multi-region enabled:", JSON.stringify(mr.recordset));
  const dur = await db.query(`SELECT AVG(CAST(TotalMs AS FLOAT)) AS AvgSiteMs, MAX(TotalMs) AS MaxSiteMs FROM MonitorResults WHERE CheckedAt > DATEADD(HOUR, -3, SYSUTCDATETIME())`);
  console.log("site response time (last 3h):", JSON.stringify(dur.recordset[0]));
  const rl = await db.query(`SELECT COUNT(*) AS N FROM MonitorResults WHERE CheckedAt > DATEADD(HOUR, -6, SYSUTCDATETIME()) AND ErrorMessage LIKE '%Too Many%'`);
  console.log("results mentioning 'Too Many Requests' (6h):", JSON.stringify(rl.recordset[0]));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
