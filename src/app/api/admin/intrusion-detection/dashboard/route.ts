import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import type { DashboardStats } from "@/lib/intrusionDetection/shared";

export async function GET() {
  const session = await requireSecurityRole("viewer");
  if (!isSecuritySession(session)) return session;

  const db = await getDb();

  const [totals, categories, paths, ips, rules, statusDist, overTime, health] = await Promise.all([
    db.query<{ TotalEvents: number; OpenAlerts: number; CriticalAlerts: number; BlockedIps: number; FailedLogins24h: number }>(`
      SELECT
        (SELECT COUNT(*) FROM SecurityEvents) AS TotalEvents,
        (SELECT COUNT(*) FROM SecurityAlerts WHERE Status NOT IN ('Resolved', 'FalsePositive')) AS OpenAlerts,
        (SELECT COUNT(*) FROM SecurityAlerts WHERE Severity = 'critical' AND Status NOT IN ('Resolved', 'FalsePositive')) AS CriticalAlerts,
        (SELECT COUNT(*) FROM SecurityIpBlocklist WHERE IsActive = 1 AND (ExpiresAt IS NULL OR ExpiresAt > SYSUTCDATETIME())) AS BlockedIps,
        (SELECT COUNT(*) FROM SecurityEvents WHERE DataSource = 'admin_audit_log' AND ResponseStatus = 401 AND EventTime >= DATEADD(HOUR, -24, SYSUTCDATETIME())) AS FailedLogins24h
    `),
    db.query<{ category: string; count: number }>(`
      SELECT TOP 8 Category AS category, COUNT(*) AS count FROM SecurityAlerts
      WHERE CreatedAt >= DATEADD(DAY, -30, SYSUTCDATETIME())
      GROUP BY Category ORDER BY COUNT(*) DESC
    `),
    db.query<{ path: string; count: number }>(`
      SELECT TOP 8 RequestPath AS path, COUNT(*) AS count FROM SecurityAlerts
      WHERE RequestPath IS NOT NULL AND CreatedAt >= DATEADD(DAY, -30, SYSUTCDATETIME())
      GROUP BY RequestPath ORDER BY COUNT(*) DESC
    `),
    db.query<{ ip: string; count: number }>(`
      SELECT TOP 8 SourceIp AS ip, COUNT(*) AS count FROM SecurityAlerts
      WHERE SourceIp IS NOT NULL AND CreatedAt >= DATEADD(DAY, -30, SYSUTCDATETIME())
      GROUP BY SourceIp ORDER BY COUNT(*) DESC
    `),
    db.query<{ ruleName: string; count: number }>(`
      SELECT TOP 8 r.Name AS ruleName, COUNT(*) AS count FROM SecurityAlerts a
      JOIN SecurityDetectionRules r ON r.Id = a.RuleId
      WHERE a.CreatedAt >= DATEADD(DAY, -30, SYSUTCDATETIME())
      GROUP BY r.Name ORDER BY COUNT(*) DESC
    `),
    db.query<{ status: number; count: number }>(`
      SELECT ResponseStatus AS status, COUNT(*) AS count FROM SecurityEvents
      WHERE ResponseStatus IS NOT NULL AND EventTime >= DATEADD(DAY, -7, SYSUTCDATETIME())
      GROUP BY ResponseStatus ORDER BY COUNT(*) DESC
    `),
    db.query<{ bucket: string; count: number }>(`
      SELECT CONVERT(VARCHAR(13), CreatedAt, 126) AS bucket, COUNT(*) AS count FROM SecurityAlerts
      WHERE CreatedAt >= DATEADD(DAY, -7, SYSUTCDATETIME())
      GROUP BY CONVERT(VARCHAR(13), CreatedAt, 126) ORDER BY bucket ASC
    `),
    db.query<{ name: string; status: string; lastRunAt: string | null; lastErrorMessage: string | null }>(`
      SELECT Name AS name, ISNULL(LastRunStatus, 'NeverRun') AS status,
        CONVERT(VARCHAR(19), LastRunAt, 126) AS lastRunAt, LastErrorMessage AS lastErrorMessage
      FROM SecurityLogSources WHERE Enabled = 1 ORDER BY Name
    `),
  ]);

  const requestsPerMinuteResult = await db.query<{ Cnt: number }>(`
    SELECT COUNT(*) AS Cnt FROM SecurityEvents WHERE EventTime >= DATEADD(MINUTE, -1, SYSUTCDATETIME())
  `);

  const stats: DashboardStats = {
    totalEvents: totals.recordset[0].TotalEvents,
    openAlerts: totals.recordset[0].OpenAlerts,
    criticalAlerts: totals.recordset[0].CriticalAlerts,
    blockedIps: totals.recordset[0].BlockedIps,
    failedLogins24h: totals.recordset[0].FailedLogins24h,
    requestsPerMinute: requestsPerMinuteResult.recordset[0].Cnt,
    topCategories: categories.recordset,
    topPaths: paths.recordset,
    topSourceIps: ips.recordset,
    topRules: rules.recordset,
    statusDistribution: statusDist.recordset,
    alertsOverTime: overTime.recordset,
    collectorHealth: health.recordset.map((h) => ({ name: h.name, status: h.status, lastRunAt: h.lastRunAt, lastErrorMessage: h.lastErrorMessage })),
  };

  return NextResponse.json({ ok: true, data: stats });
}
