import { getDb } from "../db";
import { computeSecurityScore, getComponentCounts, riskLevelForScore } from "./securityScore";
import { listScoreSnapshots } from "./repository";

export interface RecentSecurityEvent {
  source: "Vulnerability" | "Malware" | "IntrusionAlert" | "Incident";
  title: string;
  severity: string;
  occurredAt: Date;
  detailUrl: string;
}

export interface SecurityCenterOverview {
  overallScore: number;
  riskLevel: string;
  componentScores: Record<string, number>;
  scoreTrend: { snapshotAt: Date; overallScore: number }[];
  assetCounts: { websites: number; servers: number; workstations: number };
  vulnerabilityCountsBySeverity: Record<string, number>;
  malwareCountsBySeverity: Record<string, number>;
  intrusionAlertCountsBySeverity: Record<string, number>;
  activeIncidentsCount: number;
  sslExpiringSoon: { monitorName: string; expiresAt: Date }[];
  topThreatSources: { countryCode: string | null; count: number }[];
  recentEvents: RecentSecurityEvent[];
  recommendedActions: string[];
}

const SSL_EXPIRY_WARNING_DAYS = 30;
const RECENT_EVENTS_LIMIT = 20;

export async function getSecurityCenterOverview(): Promise<SecurityCenterOverview> {
  const db = await getDb();

  const counts = await getComponentCounts();
  const { overallScore, componentScores } = computeSecurityScore(counts);
  const scoreTrend = await listScoreSnapshots(168); // up to 7 days of hourly snapshots

  const assetResult = await db.query<{ Websites: number; Servers: number; Workstations: number }>(`
    SELECT
      (SELECT COUNT(*) FROM Websites WHERE Enabled = 1) AS Websites,
      (SELECT COUNT(*) FROM Devices WHERE DeviceType = 'Server') AS Servers,
      (SELECT COUNT(*) FROM Devices WHERE DeviceType = 'Workstation') AS Workstations
  `);
  const assets = assetResult.recordset[0] ?? { Websites: 0, Servers: 0, Workstations: 0 };

  const activeIncidentsResult = await db.query<{ Cnt: number }>("SELECT COUNT(*) AS Cnt FROM Incidents WHERE Status <> 'Resolved'");

  const sslExpiringResult = await db.query<{ MonitorName: string; ExpiresAt: Date }>(`
    SELECT m.Name AS MonitorName, s.ExpiresAt
    FROM SslCertificateRecords s JOIN Monitors m ON m.Id = s.MonitorId
    WHERE s.ExpiresAt IS NOT NULL AND s.ExpiresAt <= DATEADD(DAY, ${SSL_EXPIRY_WARNING_DAYS}, SYSUTCDATETIME())
    ORDER BY s.ExpiresAt ASC
  `);

  const topThreatSourcesResult = await db.query<{ CountryCode: string | null; Cnt: number }>(`
    SELECT TOP 10 CountryCode, COUNT(*) AS Cnt FROM SecurityIpProfiles
    WHERE TotalAlerts > 0
    GROUP BY CountryCode ORDER BY COUNT(*) DESC
  `);

  const recentVulnResult = await db.query<{ Id: number; Title: string; Severity: string; CreatedAt: Date }>(
    `SELECT TOP ${RECENT_EVENTS_LIMIT} Id, Title, Severity, CreatedAt FROM VulnerabilityFindings ORDER BY CreatedAt DESC`
  );
  const recentMalwareResult = await db.query<{ Id: number; CheckType: string; Severity: string; DeviceId: string | null; WebsiteId: number | null; CompletedAt: Date | null }>(
    `SELECT TOP ${RECENT_EVENTS_LIMIT} mf.Id, mf.CheckType, mf.Severity, ms.DeviceId, ms.WebsiteId, ms.CompletedAt
     FROM MalwareFindings mf JOIN MalwareScans ms ON ms.Id = mf.ScanId
     ORDER BY ms.CompletedAt DESC`
  );
  const recentAlertsResult = await db.query<{ Id: number; Category: string; Severity: string; CreatedAt: Date }>(
    `SELECT TOP ${RECENT_EVENTS_LIMIT} Id, Category, Severity, CreatedAt FROM SecurityAlerts ORDER BY CreatedAt DESC`
  );
  const recentIncidentsResult = await db.query<{ Id: number; Title: string; Severity: string; StartedAt: Date }>(
    `SELECT TOP ${RECENT_EVENTS_LIMIT} Id, Title, Severity, StartedAt FROM Incidents ORDER BY StartedAt DESC`
  );

  const recentEvents: RecentSecurityEvent[] = [
    ...recentVulnResult.recordset.map((r) => ({
      source: "Vulnerability" as const,
      title: r.Title,
      severity: r.Severity,
      occurredAt: r.CreatedAt,
      detailUrl: `/dashboard/security-center/vulnerability-scanner`,
    })),
    ...recentMalwareResult.recordset.map((r) => ({
      source: "Malware" as const,
      title: r.CheckType,
      severity: r.Severity,
      occurredAt: r.CompletedAt ?? new Date(0), // MalwareFindings itself has no timestamp - use the owning scan's completion time
      detailUrl: r.DeviceId ? `/dashboard/malware-detection/${r.DeviceId}` : `/dashboard/malware-detection`,
    })),
    ...recentAlertsResult.recordset.map((r) => ({
      source: "IntrusionAlert" as const,
      title: r.Category,
      severity: r.Severity,
      occurredAt: r.CreatedAt,
      detailUrl: `/dashboard/security`,
    })),
    ...recentIncidentsResult.recordset.map((r) => ({
      source: "Incident" as const,
      title: r.Title,
      severity: r.Severity,
      occurredAt: r.StartedAt,
      detailUrl: `/dashboard/monitoring/incidents`,
    })),
  ]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, RECENT_EVENTS_LIMIT);

  const recommendedActions: string[] = [];
  if (sslExpiringResult.recordset.length > 0) {
    recommendedActions.push(`${sslExpiringResult.recordset.length} SSL certificate(s) expiring within ${SSL_EXPIRY_WARNING_DAYS} days — renew now.`);
  }
  const criticalVulns = counts.vulnerabilities["Critical"] ?? 0;
  if (criticalVulns > 0) {
    recommendedActions.push(`${criticalVulns} critical vulnerability finding(s) open — review in Vulnerability Scanner.`);
  }
  const criticalMalware = counts.malware["Critical"] ?? 0;
  if (criticalMalware > 0) {
    recommendedActions.push(`${criticalMalware} critical malware finding(s) unresolved — review in Malware Detection.`);
  }
  const activeIncidents = activeIncidentsResult.recordset[0]?.Cnt ?? 0;
  if (activeIncidents > 0) {
    recommendedActions.push(`${activeIncidents} active monitoring incident(s) — review in Incidents.`);
  }
  if (recommendedActions.length === 0) {
    recommendedActions.push("No urgent issues detected across tracked assets right now.");
  }

  return {
    overallScore,
    riskLevel: riskLevelForScore(overallScore),
    componentScores,
    scoreTrend,
    assetCounts: { websites: assets.Websites, servers: assets.Servers, workstations: assets.Workstations },
    vulnerabilityCountsBySeverity: counts.vulnerabilities,
    malwareCountsBySeverity: counts.malware,
    intrusionAlertCountsBySeverity: counts.intrusionAlerts,
    activeIncidentsCount: activeIncidents,
    sslExpiringSoon: sslExpiringResult.recordset.map((r) => ({ monitorName: r.MonitorName, expiresAt: r.ExpiresAt })),
    topThreatSources: topThreatSourcesResult.recordset.map((r) => ({ countryCode: r.CountryCode, count: r.Cnt })),
    recentEvents,
    recommendedActions,
  };
}
