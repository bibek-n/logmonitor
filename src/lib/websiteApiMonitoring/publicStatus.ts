import { getDb } from "../db";

// Public status page data - deliberately narrower than every internal monitoring view in this
// module. Only Website monitors are included (API monitors are far more likely to be internal
// backend endpoints whose existence/URL shouldn't be broadcast to the open internet) and Paused
// monitors are excluded entirely (a monitor an admin deliberately turned off isn't something to
// report status for, paused or not). Incident history is StartedAt/ResolvedAt/Severity only -
// never an admin's free-text Title or FailureReason, which can contain internal commentary
// (ticket numbers, stack traces, infrastructure details) never meant for public consumption.
export type PublicMonitorStatus = "Operational" | "Degraded" | "Down" | "Maintenance" | "Unknown";

export interface PublicMonitorRow {
  id: number;
  name: string;
  hostname: string;
  status: PublicMonitorStatus;
}

export interface PublicIncidentRow {
  monitorName: string;
  severity: string;
  startedAt: string;
  resolvedAt: string | null;
}

export interface PublicStatusData {
  monitors: PublicMonitorRow[];
  recentIncidents: PublicIncidentRow[];
  generatedAt: string;
}

function toPublicStatus(status: string): PublicMonitorStatus {
  if (status === "Up") return "Operational";
  if (status === "Degraded") return "Degraded";
  if (status === "Down") return "Down";
  if (status === "Maintenance") return "Maintenance";
  return "Unknown"; // Pending/Unknown - still confirming, nothing to report confidently yet
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export async function getPublicStatus(): Promise<PublicStatusData> {
  const db = await getDb();

  const monitorsResult = await db.query<{ Id: number; Name: string; Url: string; Status: string }>(`
    SELECT m.Id, m.Name, w.Url, m.Status
    FROM Monitors m
    JOIN WebsiteMonitorConfigs w ON w.MonitorId = m.Id
    WHERE m.MonitorType = 'Website' AND m.IsDeleted = 0 AND m.IsActive = 1 AND m.Status <> 'Paused'
    ORDER BY m.Name ASC
  `);

  const incidentsResult = await db.query<{ MonitorName: string; Severity: string; StartedAt: string; ResolvedAt: string | null }>(`
    SELECT TOP 30 m.Name AS MonitorName, i.Severity, CONVERT(VARCHAR(33), i.StartedAt, 126) AS StartedAt, CONVERT(VARCHAR(33), i.ResolvedAt, 126) AS ResolvedAt
    FROM Incidents i
    JOIN Monitors m ON m.Id = i.MonitorId
    WHERE m.MonitorType = 'Website' AND m.IsDeleted = 0 AND i.StartedAt >= DATEADD(DAY, -30, SYSUTCDATETIME())
    ORDER BY i.StartedAt DESC
  `);

  return {
    monitors: monitorsResult.recordset.map((r) => ({ id: r.Id, name: r.Name, hostname: extractHostname(r.Url), status: toPublicStatus(r.Status) })),
    recentIncidents: incidentsResult.recordset.map((r) => ({ monitorName: r.MonitorName, severity: r.Severity, startedAt: r.StartedAt, resolvedAt: r.ResolvedAt })),
    generatedAt: new Date().toISOString(),
  };
}
