import { getDb, sql } from "@/lib/db";
import type { OpenAI } from "openai";

// Additional AI Assistant tools covering the modules the original 4-tool set (Devices/CPU,
// offline devices, router bandwidth, IIS SSL certs - see tools.ts) didn't reach: malware
// detection, intrusion detection, threat scanner, QA, SQL Server Monitoring, cameras/NVR,
// Sophos, website security/performance/headers audits, disk health, notifications, staff
// presence, admin audit log, router health, code quality, Laravel security, remote support.
// Kept in a separate module from tools.ts (merged into its TOOL_HANDLERS/TOOL_DEFINITIONS
// exports) so this genuinely new work has its own file rather than being folded into a file
// that already existed before it. Same fixed-handler, no-raw-SQL-tool design as tools.ts - see
// that file's top-of-file comment for why.

// Shared severity ordering for tools whose findings table uses the Low/Medium/High/Critical
// vocabulary (malware, code quality, Laravel security) - CASE expression, not an ORDER BY on
// the string column itself, since alphabetical order puts "Critical" before "High".
const SEVERITY_ORDER_SQL = "CASE Severity WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 3 ELSE 4 END";

async function getMalwareFindings(input: { withinDays?: number; limit?: number }) {
  const db = await getDb();
  const withinDays = Math.min(90, Math.max(1, input.withinDays ?? 14));
  const limit = Math.min(30, Math.max(1, input.limit ?? 10));
  const result = await db
    .request()
    .input("withinDays", sql.Int, withinDays)
    .query<{ CheckType: string; Severity: string; FilePath: string | null; Status: string; FirstDetectedAt: string; DeviceName: string | null; Hostname: string | null; WebsiteName: string | null }>(`
      SELECT TOP ${limit} f.CheckType, f.Severity, f.FilePath, f.Status, CONVERT(VARCHAR(19), f.FirstDetectedAt, 126) AS FirstDetectedAt,
        d.DeviceName, d.Hostname, w.Name AS WebsiteName
      FROM MalwareFindings f
      LEFT JOIN Devices d ON d.DeviceId = f.DeviceId
      LEFT JOIN Websites w ON w.Id = f.WebsiteId
      WHERE f.Status = 'Open' AND f.FirstDetectedAt >= DATEADD(DAY, -@withinDays, SYSUTCDATETIME())
      ORDER BY ${SEVERITY_ORDER_SQL.replace("Severity", "f.Severity")}, f.FirstDetectedAt DESC
    `);
  return result.recordset.map((r) => ({
    where: r.DeviceName ?? r.Hostname ?? r.WebsiteName ?? "unknown",
    checkType: r.CheckType,
    severity: r.Severity,
    filePath: r.FilePath,
    status: r.Status,
    firstDetectedAt: r.FirstDetectedAt,
  }));
}

async function getIntrusionAlerts(input: { withinDays?: number; limit?: number }) {
  const db = await getDb();
  const withinDays = Math.min(90, Math.max(1, input.withinDays ?? 7));
  const limit = Math.min(30, Math.max(1, input.limit ?? 10));
  const result = await db
    .request()
    .input("withinDays", sql.Int, withinDays)
    .query<{ Category: string | null; Severity: string; SourceIp: string | null; DestinationHost: string | null; RequestPath: string | null; Status: string; OccurrenceCount: number | null; LastSeenAt: string }>(`
      SELECT TOP ${limit} Category, Severity, SourceIp, DestinationHost, RequestPath, Status, OccurrenceCount, CONVERT(VARCHAR(19), LastSeenAt, 126) AS LastSeenAt
      FROM SecurityAlerts
      WHERE Status NOT IN ('Resolved', 'FalsePositive', 'Suppressed') AND LastSeenAt >= DATEADD(DAY, -@withinDays, SYSUTCDATETIME())
      ORDER BY LastSeenAt DESC
    `);
  return result.recordset.map((r) => ({
    category: r.Category,
    severity: r.Severity,
    sourceIp: r.SourceIp,
    destinationHost: r.DestinationHost,
    requestPath: r.RequestPath,
    status: r.Status,
    occurrenceCount: r.OccurrenceCount,
    lastSeenAt: r.LastSeenAt,
  }));
}

async function getThreatScannerResults(input: { withinDays?: number; limit?: number }) {
  const db = await getDb();
  const withinDays = Math.min(90, Math.max(1, input.withinDays ?? 14));
  const limit = Math.min(30, Math.max(1, input.limit ?? 10));
  const result = await db
    .request()
    .input("withinDays", sql.Int, withinDays)
    .query<{ Kind: string; Target: string; Verdict: string | null; MaliciousCount: number | null; SuspiciousCount: number | null; CompletedAt: string | null }>(`
      SELECT TOP ${limit} Kind, Target, Verdict, MaliciousCount, SuspiciousCount, CONVERT(VARCHAR(19), CompletedAt, 126) AS CompletedAt
      FROM ThreatScans
      WHERE Status = 'Completed' AND (ISNULL(MaliciousCount, 0) > 0 OR ISNULL(SuspiciousCount, 0) > 0)
        AND CompletedAt >= DATEADD(DAY, -@withinDays, SYSUTCDATETIME())
      ORDER BY CompletedAt DESC
    `);
  return result.recordset.map((r) => ({
    kind: r.Kind,
    target: r.Target,
    verdict: r.Verdict,
    maliciousEngines: r.MaliciousCount,
    suspiciousEngines: r.SuspiciousCount,
    completedAt: r.CompletedAt,
  }));
}

async function getQaOpenBugs(input: { limit?: number }) {
  const db = await getDb();
  const limit = Math.min(30, Math.max(1, input.limit ?? 10));
  const result = await db.query<{ BugNumber: string | null; Title: string; Severity: string; Priority: string | null; Status: string; CreatedAt: string }>(`
    SELECT TOP ${limit} BugNumber, Title, Severity, Priority, Status, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
    FROM QaBugs
    WHERE ResolvedAt IS NULL
    ORDER BY ${SEVERITY_ORDER_SQL}, CreatedAt DESC
  `);
  return result.recordset.map((r) => ({
    bugNumber: r.BugNumber,
    title: r.Title,
    severity: r.Severity,
    priority: r.Priority,
    status: r.Status,
    createdAt: r.CreatedAt,
  }));
}

async function getSqlInstanceHealth() {
  const db = await getDb();
  const result = await db.query<{ Name: string; HostName: string; Engine: string; LastCheckStatus: string | null; LastErrorMessage: string | null; LastCheckAt: string | null }>(`
    SELECT Name, HostName, Engine, LastCheckStatus, LastErrorMessage, CONVERT(VARCHAR(19), LastCheckAt, 126) AS LastCheckAt
    FROM SqlServerInstances
    WHERE Enabled = 1
    ORDER BY CASE WHEN LastCheckStatus = 'Healthy' THEN 1 ELSE 0 END, LastCheckAt DESC
  `);
  return result.recordset.map((r) => ({
    instance: r.Name,
    host: r.HostName,
    engine: r.Engine,
    status: r.LastCheckStatus,
    lastError: r.LastErrorMessage,
    lastCheckAt: r.LastCheckAt,
  }));
}

async function getCameraStatus() {
  const db = await getDb();
  const result = await db.query<{ ChannelName: string | null; Label: string | null; Status: string; LastSeenAt: string | null; NvrName: string }>(`
    SELECT c.ChannelName, c.Label, c.Status, CONVERT(VARCHAR(19), c.LastSeenAt, 126) AS LastSeenAt, n.Name AS NvrName
    FROM NvrCameras c JOIN NvrDevices n ON n.Id = c.NvrId
    ORDER BY CASE WHEN c.Status = 'Online' THEN 1 ELSE 0 END, c.LastSeenAt DESC
  `);
  return result.recordset.map((r) => ({
    camera: r.Label ?? r.ChannelName ?? "unnamed",
    nvr: r.NvrName,
    status: r.Status,
    lastSeenAt: r.LastSeenAt,
  }));
}

async function getSophosThreats(input: { withinDays?: number; limit?: number }) {
  const db = await getDb();
  const withinDays = Math.min(90, Math.max(1, input.withinDays ?? 7));
  const limit = Math.min(30, Math.max(1, input.limit ?? 10));
  const result = await db
    .request()
    .input("withinDays", sql.Int, withinDays)
    .query<{ DeviceName: string | null; LogType: string | null; LogSubtype: string | null; Severity: string | null; SrcIp: string | null; DstIp: string | null; ReceivedAt: string }>(`
      SELECT TOP ${limit} DeviceName, LogType, LogSubtype, Severity, SrcIp, DstIp, CONVERT(VARCHAR(19), ReceivedAt, 126) AS ReceivedAt
      FROM SophosThreatLogs
      WHERE ReceivedAt >= DATEADD(DAY, -@withinDays, SYSUTCDATETIME())
      ORDER BY ReceivedAt DESC
    `);
  return result.recordset.map((r) => ({
    firewallDevice: r.DeviceName,
    type: r.LogType,
    subtype: r.LogSubtype,
    severity: r.Severity,
    sourceIp: r.SrcIp,
    destinationIp: r.DstIp,
    receivedAt: r.ReceivedAt,
  }));
}

async function getWebsiteAuditFindings(input: { withinDays?: number; limit?: number }) {
  const db = await getDb();
  const withinDays = Math.min(90, Math.max(1, input.withinDays ?? 30));
  const limit = Math.min(30, Math.max(1, input.limit ?? 10));
  const result = await db
    .request()
    .input("withinDays", sql.Int, withinDays)
    .query<{ Website: string; Category: string | null; Severity: string; Title: string; ScanDate: string | null }>(`
      SELECT TOP ${limit} w.Name AS Website, f.Category, f.Severity, f.Title, CONVERT(VARCHAR(19), s.ScanDate, 126) AS ScanDate
      FROM WebsiteAuditFindings f
      JOIN WebsiteAuditScans s ON s.Id = f.ScanId
      JOIN Websites w ON w.Id = s.WebsiteId
      WHERE s.ScanDate >= DATEADD(DAY, -@withinDays, SYSUTCDATETIME())
      ORDER BY ${SEVERITY_ORDER_SQL.replace("Severity", "f.Severity")}, s.ScanDate DESC
    `);
  return result.recordset.map((r) => ({
    website: r.Website,
    category: r.Category,
    severity: r.Severity,
    title: r.Title,
    scanDate: r.ScanDate,
  }));
}

async function getWebsitePerformanceAlerts(input: { limit?: number }) {
  const db = await getDb();
  const limit = Math.min(30, Math.max(1, input.limit ?? 10));
  const result = await db.query<{ Website: string; AlertType: string | null; Severity: string | null; Detail: string | null; TriggeredAt: string }>(`
    SELECT TOP ${limit} w.Name AS Website, a.AlertType, a.Severity, a.Detail, CONVERT(VARCHAR(19), a.TriggeredAt, 126) AS TriggeredAt
    FROM WebsitePerformanceAlerts a
    JOIN Websites w ON w.Id = a.WebsiteId
    WHERE a.ResolvedAt IS NULL
    ORDER BY a.TriggeredAt DESC
  `);
  return result.recordset.map((r) => ({
    website: r.Website,
    alertType: r.AlertType,
    severity: r.Severity,
    detail: r.Detail,
    triggeredAt: r.TriggeredAt,
  }));
}

async function getDiskHealthIssues() {
  const db = await getDb();
  const result = await db.query<{ DeviceName: string | null; Hostname: string; Model: string | null; HealthStatus: string | null; OperationalStatus: string | null; TemperatureCelsius: number | null }>(`
    SELECT d.DeviceName, d.Hostname, dd.Model, dd.HealthStatus, dd.OperationalStatus, dd.TemperatureCelsius
    FROM DeviceDisks dd
    JOIN Devices d ON d.DeviceId = dd.DeviceId
    WHERE dd.HealthStatus IS NOT NULL AND dd.HealthStatus <> 'Healthy'
  `);
  return result.recordset.map((r) => ({
    device: r.DeviceName ?? r.Hostname,
    diskModel: r.Model,
    healthStatus: r.HealthStatus,
    operationalStatus: r.OperationalStatus,
    temperatureCelsius: r.TemperatureCelsius,
  }));
}

async function getSecurityHeaderIssues(input: { withinDays?: number; limit?: number }) {
  const db = await getDb();
  const withinDays = Math.min(90, Math.max(1, input.withinDays ?? 30));
  const limit = Math.min(30, Math.max(1, input.limit ?? 10));
  const result = await db
    .request()
    .input("withinDays", sql.Int, withinDays)
    .query<{ Website: string | null; TargetUrl: string; Grade: string | null; Score: number | null; ScannedAt: string }>(`
      SELECT TOP ${limit} w.Name AS Website, h.TargetUrl, h.Grade, h.Score, CONVERT(VARCHAR(19), h.ScannedAt, 126) AS ScannedAt
      FROM SecurityHeaderScans h
      LEFT JOIN Websites w ON w.Id = h.WebsiteId
      WHERE h.ScannedAt >= DATEADD(DAY, -@withinDays, SYSUTCDATETIME())
      ORDER BY h.ScannedAt DESC
    `);
  return result.recordset.map((r) => ({
    website: r.Website ?? r.TargetUrl,
    url: r.TargetUrl,
    grade: r.Grade,
    score: r.Score,
    scannedAt: r.ScannedAt,
  }));
}

async function getNotificationRecipients() {
  const db = await getDb();
  const result = await db.query<{ ModuleKey: string; SubModuleKey: string; Recipients: string; Enabled: boolean }>(`
    SELECT ModuleKey, SubModuleKey, Recipients, Enabled FROM NotificationRecipients ORDER BY ModuleKey, SubModuleKey
  `);
  return result.recordset.map((r) => ({
    module: r.SubModuleKey ? `${r.ModuleKey}/${r.SubModuleKey}` : r.ModuleKey,
    recipients: r.Enabled ? r.Recipients : null,
    enabled: r.Enabled,
  }));
}

async function getStaffStatus(input: { onlineOnly?: boolean }) {
  const { getStaffWithStatus } = await import("../staffStatus");
  const staff = await getStaffWithStatus();
  const rows = input.onlineOnly ? staff.filter((s) => s.isOnline) : staff;
  return rows.map((s) => ({
    name: s.Name,
    isOnline: s.isOnline,
    device: s.computerNameOverride ?? s.deviceName,
    network: s.source,
    lastSeen: s.lastSeen,
  }));
}

async function getRecentAdminActions(input: { limit?: number }) {
  const db = await getDb();
  const limit = Math.min(30, Math.max(1, input.limit ?? 15));
  const result = await db.query<{ Username: string | null; Section: string; Action: string; Details: string | null; CreatedAt: string }>(`
    SELECT TOP ${limit} Username, Section, Action, Details, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
    FROM AdminAuditLog ORDER BY CreatedAt DESC
  `);
  return result.recordset.map((r) => ({
    admin: r.Username,
    section: r.Section,
    action: r.Action,
    details: r.Details,
    at: r.CreatedAt,
  }));
}

async function getRouterHealth() {
  const db = await getDb();
  const result = await db.query<{
    ReceivedAt: string; UptimeSeconds: string | null; Version: string | null; BoardName: string | null;
    CpuLoadPct: number | null; FreeMemoryMB: number | null; TotalMemoryMB: number | null;
    FreeDiskMB: number | null; TotalDiskMB: number | null; Temperature: number | null; Voltage: number | null;
  }>(`
    SELECT TOP 1 CONVERT(VARCHAR(19), ReceivedAt, 126) AS ReceivedAt, UptimeSeconds, Version, BoardName,
      CpuLoadPct, FreeMemoryMB, TotalMemoryMB, FreeDiskMB, TotalDiskMB, Temperature, Voltage
    FROM RouterHealth ORDER BY ReceivedAt DESC
  `);
  const r = result.recordset[0];
  if (!r) return { message: "No router health data collected yet." };
  return {
    sampledAt: r.ReceivedAt,
    uptimeSeconds: r.UptimeSeconds,
    version: r.Version,
    boardName: r.BoardName,
    cpuLoadPct: r.CpuLoadPct,
    memoryUsedMB: r.FreeMemoryMB != null && r.TotalMemoryMB != null ? r.TotalMemoryMB - r.FreeMemoryMB : null,
    totalMemoryMB: r.TotalMemoryMB,
    freeDiskMB: r.FreeDiskMB,
    totalDiskMB: r.TotalDiskMB,
    temperatureCelsius: r.Temperature,
    voltage: r.Voltage,
  };
}

async function getCodeQualityIssues(input: { limit?: number }) {
  const db = await getDb();
  const limit = Math.min(30, Math.max(1, input.limit ?? 10));
  const result = await db.query<{ Project: string; Category: string; Severity: string; Title: string; FilePath: string | null; CreatedAt: string }>(`
    SELECT TOP ${limit} p.Name AS Project, i.Category, i.Severity, i.Title, i.FilePath, CONVERT(VARCHAR(19), i.CreatedAt, 126) AS CreatedAt
    FROM CodeQualityIssues i JOIN CodeQualityProjects p ON p.Id = i.ProjectId
    WHERE i.Status = 'Open'
    ORDER BY ${SEVERITY_ORDER_SQL.replace("Severity", "i.Severity")}, i.CreatedAt DESC
  `);
  return result.recordset.map((r) => ({
    project: r.Project,
    category: r.Category,
    severity: r.Severity,
    title: r.Title,
    filePath: r.FilePath,
    createdAt: r.CreatedAt,
  }));
}

async function getLaravelSecurityIssues(input: { limit?: number }) {
  const db = await getDb();
  const limit = Math.min(30, Math.max(1, input.limit ?? 10));
  const result = await db.query<{ Project: string; Category: string; Severity: string; Title: string; FilePath: string | null; CreatedAt: string }>(`
    SELECT TOP ${limit} p.Name AS Project, i.Category, i.Severity, i.Title, i.FilePath, CONVERT(VARCHAR(19), i.CreatedAt, 126) AS CreatedAt
    FROM LaravelSecurityIssues i JOIN LaravelSecurityProjects p ON p.Id = i.ProjectId
    WHERE i.Status = 'Open'
    ORDER BY ${SEVERITY_ORDER_SQL.replace("Severity", "i.Severity")}, i.CreatedAt DESC
  `);
  return result.recordset.map((r) => ({
    project: r.Project,
    category: r.Category,
    severity: r.Severity,
    title: r.Title,
    filePath: r.FilePath,
    createdAt: r.CreatedAt,
  }));
}

async function getRemoteSupportSessions(input: { limit?: number }) {
  const db = await getDb();
  const limit = Math.min(30, Math.max(1, input.limit ?? 10));
  const result = await db.query<{ DeviceName: string | null; Hostname: string | null; Status: string; Reason: string | null; RequestedAt: string; StartedAt: string | null; EndedAt: string | null }>(`
    SELECT TOP ${limit} d.DeviceName, d.Hostname, r.Status, r.Reason,
      CONVERT(VARCHAR(19), r.RequestedAt, 126) AS RequestedAt, CONVERT(VARCHAR(19), r.StartedAt, 126) AS StartedAt, CONVERT(VARCHAR(19), r.EndedAt, 126) AS EndedAt
    FROM RemoteSupportSessions r LEFT JOIN Devices d ON d.DeviceId = r.DeviceId
    ORDER BY r.RequestedAt DESC
  `);
  return result.recordset.map((r) => ({
    device: r.DeviceName ?? r.Hostname,
    status: r.Status,
    reason: r.Reason,
    requestedAt: r.RequestedAt,
    startedAt: r.StartedAt,
    endedAt: r.EndedAt,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolHandler = (input: any) => Promise<unknown>;

export const EXPANSION_TOOL_HANDLERS: Record<string, ToolHandler> = {
  get_malware_findings: getMalwareFindings,
  get_intrusion_alerts: getIntrusionAlerts,
  get_threat_scanner_results: getThreatScannerResults,
  get_qa_open_bugs: getQaOpenBugs,
  get_sql_instance_health: getSqlInstanceHealth,
  get_camera_status: getCameraStatus,
  get_sophos_threats: getSophosThreats,
  get_website_audit_findings: getWebsiteAuditFindings,
  get_website_performance_alerts: getWebsitePerformanceAlerts,
  get_disk_health_issues: getDiskHealthIssues,
  get_security_header_issues: getSecurityHeaderIssues,
  get_notification_recipients: getNotificationRecipients,
  get_staff_status: getStaffStatus,
  get_recent_admin_actions: getRecentAdminActions,
  get_router_health: getRouterHealth,
  get_code_quality_issues: getCodeQualityIssues,
  get_laravel_security_issues: getLaravelSecurityIssues,
  get_remote_support_sessions: getRemoteSupportSessions,
};

export const EXPANSION_TOOL_DEFINITIONS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_malware_findings",
      description: "Get open (unresolved) malware findings from device/website malware scans - web shells, obfuscated PHP, cryptominers, hidden iframes, etc.",
      parameters: {
        type: "object",
        properties: {
          withinDays: { type: "number", description: "Only include findings first detected within this many days (default 14, max 90)." },
          limit: { type: "number", description: "Max results (default 10, max 30)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_intrusion_alerts",
      description: "Get active (not resolved/false-positive/suppressed) intrusion detection security alerts - attempted attacks, suspicious requests, etc.",
      parameters: {
        type: "object",
        properties: {
          withinDays: { type: "number", description: "Only include alerts last seen within this many days (default 7, max 90)." },
          limit: { type: "number", description: "Max results (default 10, max 30)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_threat_scanner_results",
      description: "Get recent Threat Scanner (VirusTotal) scans that came back malicious or suspicious for a file, URL, hash, IP, or domain.",
      parameters: {
        type: "object",
        properties: {
          withinDays: { type: "number", description: "Only include scans completed within this many days (default 14, max 90)." },
          limit: { type: "number", description: "Max results (default 10, max 30)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_qa_open_bugs",
      description: "Get open (unresolved) QA bugs, most severe and most recent first.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results (default 10, max 30)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sql_instance_health",
      description: "Get the health status of every monitored SQL Server/MySQL/PostgreSQL instance (SQL Server Monitoring feature) - unhealthy/failed instances first.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_camera_status",
      description: "Get every NVR camera's online/offline status.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sophos_threats",
      description: "Get recent threat/security events logged by the Sophos firewall (malware blocked, IPS hits, etc.).",
      parameters: {
        type: "object",
        properties: {
          withinDays: { type: "number", description: "Only include events within this many days (default 7, max 90)." },
          limit: { type: "number", description: "Max results (default 10, max 30)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_website_audit_findings",
      description: "Get website security audit findings (from scheduled security scans of registered websites), most severe and most recent first.",
      parameters: {
        type: "object",
        properties: {
          withinDays: { type: "number", description: "Only include findings from scans within this many days (default 30, max 90)." },
          limit: { type: "number", description: "Max results (default 10, max 30)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_website_performance_alerts",
      description: "Get current (unresolved) website performance/speed threshold-breach alerts.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results (default 10, max 30)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_disk_health_issues",
      description: "Get physical disks across all servers/workstations that are NOT reporting a Healthy SMART status - possible failing hardware.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_security_header_issues",
      description: "Get recent website security-header scan results (grade/score for missing headers like CSP, HSTS, etc.).",
      parameters: {
        type: "object",
        properties: {
          withinDays: { type: "number", description: "Only include scans within this many days (default 30, max 90)." },
          limit: { type: "number", description: "Max results (default 10, max 30)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_notification_recipients",
      description: "Get which email addresses are configured to receive alerts for each module (intrusion detection, SQL monitoring, website audit, etc.), and whether that module's alerts are enabled.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_staff_status",
      description: "Get staff members and whether their device is currently online (detected via the MikroTik router or Sophos firewall client lists).",
      parameters: {
        type: "object",
        properties: {
          onlineOnly: { type: "boolean", description: "If true, only return staff who are currently online." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_admin_actions",
      description: "Get the most recent admin actions from the audit log (who did what, in which section of the app, and when).",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results (default 15, max 30)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_router_health",
      description: "Get the MikroTik router's latest health sample - CPU load, memory, disk, temperature, voltage, uptime.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_code_quality_issues",
      description: "Get open code-quality issues (complexity, duplication, dead code, coding-standard violations) from scanned repositories, most severe and most recent first.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results (default 10, max 30)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_laravel_security_issues",
      description: "Get open Laravel-specific security issues (debug mode enabled, exposed .env, CSRF/mass-assignment problems, etc.) from scanned Laravel projects, most severe and most recent first.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results (default 10, max 30)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_remote_support_sessions",
      description: "Get recent remote support sessions (screen-share/remote-control requests to staff devices) - status, device, and reason.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results (default 10, max 30)." },
        },
      },
    },
  },
];
