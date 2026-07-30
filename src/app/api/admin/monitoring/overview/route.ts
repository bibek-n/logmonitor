import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";

export async function GET(req: NextRequest) {
  const mon = await requireMonitoringPermission("mon_view");
  if (!isMonitoringSession(mon)) return mon;

  const environment = req.nextUrl.searchParams.get("environment");
  const db = await getDb();

  const envFilter = environment ? "AND m.Environment = @environment" : "";
  const buildRequest = () => {
    const r = db.request();
    if (environment) r.input("environment", sql.VarChar, environment);
    return r;
  };

  const [counts, todayStats, recentIncidents, recoveredRecently, slowest, expiringSsl, recentNotifications] = await Promise.all([
    buildRequest().query(`
      SELECT
        COUNT(*) AS TotalMonitors,
        SUM(CASE WHEN MonitorType = 'Website' THEN 1 ELSE 0 END) AS WebsiteMonitors,
        SUM(CASE WHEN MonitorType = 'Api' THEN 1 ELSE 0 END) AS ApiMonitors,
        SUM(CASE WHEN Status = 'Up' THEN 1 ELSE 0 END) AS UpCount,
        SUM(CASE WHEN Status = 'Down' THEN 1 ELSE 0 END) AS DownCount,
        SUM(CASE WHEN Status = 'Degraded' THEN 1 ELSE 0 END) AS DegradedCount,
        SUM(CASE WHEN Status = 'Paused' THEN 1 ELSE 0 END) AS PausedCount,
        SUM(CASE WHEN Status = 'Maintenance' THEN 1 ELSE 0 END) AS MaintenanceCount
      FROM Monitors m WHERE IsDeleted = 0 ${envFilter}
    `),
    buildRequest().query(`
      SELECT
        COUNT(*) AS ChecksToday,
        SUM(CASE WHEN r.Success = 0 THEN 1 ELSE 0 END) AS FailedToday,
        AVG(CAST(r.TotalMs AS FLOAT)) AS AvgResponseMs,
        (SELECT COUNT(*) FROM NotificationLogs WHERE CreatedAt >= CAST(SYSUTCDATETIME() AS DATE) AND Status = 'Sent') AS AlertsToday,
        (SELECT COUNT(*) FROM Incidents WHERE Status = 'Open') AS OpenIncidents,
        (SELECT COUNT(*) FROM SslCertificateRecords WHERE DATEDIFF(DAY, SYSUTCDATETIME(), ExpiresAt) <= 30 AND DATEDIFF(DAY, SYSUTCDATETIME(), ExpiresAt) >= 0) AS SslExpiringSoon
      FROM MonitorResults r
      JOIN Monitors m ON m.Id = r.MonitorId
      WHERE r.CheckedAt >= CAST(SYSUTCDATETIME() AS DATE) ${envFilter}
    `),
    db.query(`
      SELECT TOP 5 i.Id, i.Title, i.Severity, i.Status, CONVERT(VARCHAR(19), i.StartedAt, 126) AS StartedAt, m.Name AS MonitorName
      FROM Incidents i JOIN Monitors m ON m.Id = i.MonitorId
      ORDER BY i.StartedAt DESC
    `),
    db.query(`
      SELECT TOP 5 i.Id, i.Title, CONVERT(VARCHAR(19), i.ResolvedAt, 126) AS ResolvedAt, m.Name AS MonitorName
      FROM Incidents i JOIN Monitors m ON m.Id = i.MonitorId
      WHERE i.Status = 'Resolved'
      ORDER BY i.ResolvedAt DESC
    `),
    db.query(`
      SELECT TOP 5 m.Id, m.Name, w.Url, AVG(CAST(r.TotalMs AS FLOAT)) AS AvgResponseMs
      FROM Monitors m
      JOIN WebsiteMonitorConfigs w ON w.MonitorId = m.Id
      JOIN MonitorResults r ON r.MonitorId = m.Id AND r.CheckedAt >= DATEADD(HOUR, -24, SYSUTCDATETIME())
      WHERE m.IsDeleted = 0
      GROUP BY m.Id, m.Name, w.Url
      ORDER BY AVG(CAST(r.TotalMs AS FLOAT)) DESC
    `),
    db.query(`
      SELECT TOP 5 m.Name AS MonitorName, s.Domain, DATEDIFF(DAY, SYSUTCDATETIME(), s.ExpiresAt) AS DaysRemaining
      FROM SslCertificateRecords s JOIN Monitors m ON m.Id = s.MonitorId
      WHERE DATEDIFF(DAY, SYSUTCDATETIME(), s.ExpiresAt) <= 30
      ORDER BY s.ExpiresAt ASC
    `),
    db.query(`
      SELECT TOP 5 n.EventType, n.Subject, n.Status, CONVERT(VARCHAR(19), n.CreatedAt, 126) AS CreatedAt, m.Name AS MonitorName
      FROM NotificationLogs n LEFT JOIN Monitors m ON m.Id = n.MonitorId
      ORDER BY n.CreatedAt DESC
    `),
  ]);

  const c = counts.recordset[0];
  const t = todayStats.recordset[0];

  const uptimeResult = await buildRequest().query<{ Total: number; Successful: number }>(`
    SELECT COUNT(*) AS Total, SUM(CASE WHEN r.Success = 1 THEN 1 ELSE 0 END) AS Successful
    FROM MonitorResults r JOIN Monitors m ON m.Id = r.MonitorId
    WHERE r.CheckedAt >= DATEADD(DAY, -7, SYSUTCDATETIME()) ${envFilter}
  `);
  const u = uptimeResult.recordset[0];
  const overallUptimePercent = u.Total > 0 ? (u.Successful / u.Total) * 100 : null;

  return NextResponse.json({
    ok: true,
    data: {
      totalMonitors: c.TotalMonitors,
      websiteMonitors: c.WebsiteMonitors,
      apiMonitors: c.ApiMonitors,
      upCount: c.UpCount,
      downCount: c.DownCount,
      degradedCount: c.DegradedCount,
      pausedCount: c.PausedCount,
      maintenanceCount: c.MaintenanceCount,
      openIncidents: t.OpenIncidents,
      sslExpiringSoon: t.SslExpiringSoon,
      overallUptimePercent,
      avgResponseMs: t.AvgResponseMs,
      checksToday: t.ChecksToday ?? 0,
      failedToday: t.FailedToday ?? 0,
      alertsToday: t.AlertsToday ?? 0,
      recentIncidents: recentIncidents.recordset,
      recoveredRecently: recoveredRecently.recordset,
      slowestWebsites: slowest.recordset,
      expiringSsl: expiringSsl.recordset,
      recentNotifications: recentNotifications.recordset,
    },
  });
}
