import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

// Read-only: which server / site / log source produced a Security Center alert, and did the request succeed?
// Usage: tsx scripts/check-security-alert.ts <alertId>
async function main() {
  const id = Number(process.argv[2]);
  if (!Number.isInteger(id)) {
    console.error("usage: check-security-alert.ts <alertId>");
    process.exit(2);
  }
  const db = await getDb();

  const a = await db.request().input("id", sql.Int, id).query(`
    SELECT a.Id, a.Category, a.Severity, a.RiskScore, a.SourceIp, a.DestinationHost, a.RequestMethod, a.RequestPath, a.ResponseStatus, a.UserAgent, a.Status,
      a.OccurrenceCount, CONVERT(VARCHAR(19), a.FirstSeenAt, 126) AS FirstSeenAt, CONVERT(VARCHAR(19), a.LastSeenAt, 126) AS LastSeenAt, a.EvidenceSummary,
      p.Id AS AppId, p.Name AS AppName, p.AppType, p.BaseUrl
    FROM SecurityAlerts a LEFT JOIN SecurityProtectedApplications p ON p.Id = a.ProtectedApplicationId WHERE a.Id = @id`);
  console.log("ALERT:", JSON.stringify(a.recordset[0] ?? "NOT FOUND", null, 1));
  if (!a.recordset[0]) process.exit(0);

  const ev = await db.request().input("id", sql.Int, id).query(`
    SELECT TOP 20 e.Id, CONVERT(VARCHAR(19), e.EventTime, 126) AS EventTime, e.DataSource, e.DestinationHost, e.RequestMethod, e.RequestPath, e.ResponseStatus,
      ls.Id AS LogSourceId, ls.Name AS LogSourceName, ls.AdapterType, ls.SourceSiteName, ls.SourceDeviceId, d.Hostname AS SourceDeviceHostname, d.DeviceType, d.LastIp AS SourceDeviceIp
    FROM SecurityEvents e LEFT JOIN SecurityLogSources ls ON ls.Id = e.LogSourceId LEFT JOIN Devices d ON d.DeviceId = ls.SourceDeviceId
    WHERE e.AlertId = @id ORDER BY e.EventTime DESC`);
  console.log("EVENTS linked to the alert:");
  for (const r of ev.recordset) console.log(" ", JSON.stringify(r));

  const ip = a.recordset[0].SourceIp as string | null;
  if (ip) {
    const other = await db.request().input("ip", sql.VarChar, ip).query(`
      SELECT TOP 30 ls.Name AS LogSourceName, ls.SourceSiteName, e.DestinationHost, e.RequestMethod, LEFT(e.RequestPath, 120) AS RequestPath, e.ResponseStatus,
        COUNT(*) AS Hits, CONVERT(VARCHAR(19), MIN(e.EventTime), 126) AS First, CONVERT(VARCHAR(19), MAX(e.EventTime), 126) AS Last
      FROM SecurityEvents e LEFT JOIN SecurityLogSources ls ON ls.Id = e.LogSourceId
      WHERE e.SourceIp = @ip AND e.EventTime > DATEADD(DAY, -2, SYSUTCDATETIME())
      GROUP BY ls.Name, ls.SourceSiteName, e.DestinationHost, e.RequestMethod, LEFT(e.RequestPath, 120), e.ResponseStatus ORDER BY MAX(e.EventTime) DESC`);
    console.log(`ALL requests from ${ip} in the last 2 days (${other.recordset.length} groups):`);
    for (const r of other.recordset) console.log(" ", JSON.stringify(r));
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
