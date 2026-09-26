import "dotenv/config";
import { getDb } from "../src/lib/db";

// Read-only diagnostic: why do websites / API monitors and servers look offline? Prints counts only (no secrets).
async function main() {
  const db = await getDb();
  const p = (title: string, rows: unknown[]) => {
    console.log(`\n## ${title}`);
    for (const r of rows) console.log(" ", JSON.stringify(r));
  };

  p("Monitors by type/status (active, not deleted)", (await db.query(
    "SELECT MonitorType, Status, COUNT(*) AS N FROM Monitors WHERE IsActive = 1 AND IsDeleted = 0 GROUP BY MonitorType, Status ORDER BY MonitorType, N DESC")).recordset);
  p("Monitor scheduling health", (await db.query(
    `SELECT COUNT(*) AS ActiveMonitors, CONVERT(VARCHAR(19), MAX(LastCheckedAt), 126) AS NewestCheck, CONVERT(VARCHAR(19), MIN(LastCheckedAt), 126) AS OldestCheck,
       SUM(CASE WHEN NextCheckAt < DATEADD(MINUTE, -15, SYSUTCDATETIME()) THEN 1 ELSE 0 END) AS OverdueOver15Min, CONVERT(VARCHAR(19), SYSUTCDATETIME(), 126) AS NowUtc
     FROM Monitors WHERE IsActive = 1 AND IsDeleted = 0`)).recordset);
  p("Check results per hour, last 12h (success / fail)", (await db.query(
    `SELECT CONVERT(VARCHAR(13), CheckedAt, 126) AS HourUtc, SUM(CAST(Success AS INT)) AS Ok, SUM(1 - CAST(Success AS INT)) AS Failed
     FROM MonitorResults WHERE CheckedAt > DATEADD(HOUR, -12, SYSUTCDATETIME()) GROUP BY CONVERT(VARCHAR(13), CheckedAt, 126) ORDER BY 1`)).recordset);
  p("Failure reasons, last 6h", (await db.query(
    `SELECT TOP 12 ErrorCode, HttpStatusCode, COUNT(*) AS N, MIN(LEFT(ErrorMessage, 140)) AS Example
     FROM MonitorResults WHERE Success = 0 AND CheckedAt > DATEADD(HOUR, -6, SYSUTCDATETIME()) GROUP BY ErrorCode, HttpStatusCode ORDER BY N DESC`)).recordset);
  p("Currently-down monitors (sample 12)", (await db.query(
    `SELECT TOP 12 m.Id, m.Name, m.MonitorType, m.Status, m.ConsecutiveFailures, CONVERT(VARCHAR(19), m.LastCheckedAt, 126) AS LastChecked,
       (SELECT TOP 1 LEFT(r.ErrorCode + ' ' + ISNULL(r.ErrorMessage, ''), 120) FROM MonitorResults r WHERE r.MonitorId = m.Id ORDER BY r.CheckedAt DESC) AS LastError
     FROM Monitors m WHERE m.IsActive = 1 AND m.IsDeleted = 0 AND m.Status NOT IN ('Up', 'Healthy', 'Pending') ORDER BY m.ConsecutiveFailures DESC`)).recordset);

  p("Devices by type: online (heartbeat < 5 min) vs offline", (await db.query(
    `SELECT DeviceType, SUM(CASE WHEN DATEDIFF(SECOND, LastHeartbeat, SYSUTCDATETIME()) < 300 THEN 1 ELSE 0 END) AS Online,
       SUM(CASE WHEN LastHeartbeat IS NULL OR DATEDIFF(SECOND, LastHeartbeat, SYSUTCDATETIME()) >= 300 THEN 1 ELSE 0 END) AS Offline FROM Devices GROUP BY DeviceType`)).recordset);
  p("Server-type devices", (await db.query(
    `SELECT Hostname, OS, AgentVersion, DATEDIFF(MINUTE, LastHeartbeat, SYSUTCDATETIME()) AS MinutesSinceHeartbeat, LastIp FROM Devices WHERE DeviceType = 'Server' ORDER BY LastHeartbeat DESC`)).recordset);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
