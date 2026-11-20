import { getDb, sql } from "@/lib/db";
import { getIpToStaffNameMap, getIpToStaffNameMapViaRouter, NON_STAFF_INFRASTRUCTURE_IPS } from "@/lib/topConsumers";
import { computeWeightedSecurityScore, getComponentCounts } from "@/lib/securityCenter/securityScore";
import { getDashboardStats as getItAssetDashboardStats } from "@/lib/itAssetLogsheet/repository";
import { getDashboardStats as getBrowserActivityDashboardStats } from "@/lib/browserActivity/repository";
import { reactivateExpiredSnoozes } from "@/lib/intrusionDetection/snooze";

// New real-data-only Overview widgets, one query function per widget - every one of these
// hits a table that already exists and is populated by an existing feature module (see the
// per-module research done before writing this). Deliberately excludes anything this app
// doesn't actually track yet (VPN connections, website traffic/analytics,
// account lockout, pending invitations, password-expiry policy, database engine health,
// license/subscription status, download activity, antivirus-as-a-single-flag) rather than
// fabricating numbers for a real ops tool.

export interface QuickStats {
  totalUsers: number;
  activeDevices: number;
  onlineServers: number;
  activeWebsites: number;
  runningAutomations: number;
  openSecurityAlerts: number;
  openSecurityAlertsBySeverity: { critical: number; high: number; medium: number; low: number; informational: number };
}

export async function getQuickStats(): Promise<QuickStats> {
  await reactivateExpiredSnoozes();
  const db = await getDb();
  const [result, bySeverityResult] = await Promise.all([
    db.query<{
      TotalUsers: number;
      ActiveDevices: number;
      OnlineServers: number;
      ActiveWebsites: number;
      RunningAutomations: number;
      OpenSecurityAlerts: number;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM Users) AS TotalUsers,
        (SELECT COUNT(*) FROM Devices WHERE LastHeartbeat >= DATEADD(MINUTE, -10, SYSUTCDATETIME())) AS ActiveDevices,
        (SELECT COUNT(*) FROM Devices WHERE DeviceType = 'Server' AND LastHeartbeat >= DATEADD(MINUTE, -10, SYSUTCDATETIME())) AS OnlineServers,
        (SELECT COUNT(*) FROM Websites WHERE Enabled = 1) AS ActiveWebsites,
        (SELECT COUNT(*) FROM AutomationJobTargets WHERE Status = 'Running') AS RunningAutomations,
        (SELECT COUNT(*) FROM SecurityAlerts WHERE Status NOT IN ('Resolved', 'FalsePositive', 'Suppressed')) AS OpenSecurityAlerts
    `),
    db.query<{ Severity: string; Cnt: number }>(`
      SELECT Severity, COUNT(*) AS Cnt FROM SecurityAlerts
      WHERE Status NOT IN ('Resolved', 'FalsePositive', 'Suppressed')
      GROUP BY Severity
    `),
  ]);
  const r = result.recordset[0];
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
  for (const row of bySeverityResult.recordset) {
    if (row.Severity in bySeverity) bySeverity[row.Severity as keyof typeof bySeverity] = row.Cnt;
  }
  return {
    totalUsers: r.TotalUsers,
    activeDevices: r.ActiveDevices,
    onlineServers: r.OnlineServers,
    activeWebsites: r.ActiveWebsites,
    runningAutomations: r.RunningAutomations,
    openSecurityAlerts: r.OpenSecurityAlerts,
    openSecurityAlertsBySeverity: bySeverity,
  };
}

export interface UserManagementSummary {
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  mfaEnabledUsers: number;
  loginSuccess24h: number;
  loginFailed24h: number;
}

export async function getUserManagementSummary(): Promise<UserManagementSummary> {
  const db = await getDb();
  const result = await db.query<{
    TotalUsers: number;
    ActiveUsers: number;
    DisabledUsers: number;
    MfaEnabledUsers: number;
    LoginSuccess24h: number;
    LoginFailed24h: number;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM Users) AS TotalUsers,
      (SELECT COUNT(*) FROM Users WHERE IsActive = 1) AS ActiveUsers,
      (SELECT COUNT(*) FROM Users WHERE IsActive = 0) AS DisabledUsers,
      (SELECT COUNT(*) FROM Users WHERE TotpEnabled = 1) AS MfaEnabledUsers,
      (SELECT COUNT(*) FROM LoginActivity WHERE Success = 1 AND CreatedAt >= DATEADD(HOUR, -24, SYSUTCDATETIME())) AS LoginSuccess24h,
      (SELECT COUNT(*) FROM LoginActivity WHERE Success = 0 AND CreatedAt >= DATEADD(HOUR, -24, SYSUTCDATETIME())) AS LoginFailed24h
  `);
  const r = result.recordset[0];
  return {
    totalUsers: r.TotalUsers,
    activeUsers: r.ActiveUsers,
    disabledUsers: r.DisabledUsers,
    mfaEnabledUsers: r.MfaEnabledUsers,
    loginSuccess24h: r.LoginSuccess24h,
    loginFailed24h: r.LoginFailed24h,
  };
}

export interface SecurityCenterSummary {
  overallScore: number;
  criticalAlerts: number;
  blockedIps: number;
  vulnerabilitiesBySeverity: Record<string, number>;
  devicesWithFirewallOff: number;
  devicesWithAvDisabled: number;
}

export async function getSecurityCenterSummary(): Promise<SecurityCenterSummary> {
  await reactivateExpiredSnoozes();
  const db = await getDb();
  const { overallScore } = await computeWeightedSecurityScore();
  const counts = await getComponentCounts();

  const result = await db.query<{
    CriticalAlerts: number;
    BlockedIps: number;
    FirewallOff: number;
    AvDisabled: number;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM SecurityAlerts WHERE Severity = 'critical' AND Status NOT IN ('Resolved','FalsePositive','Suppressed')) AS CriticalAlerts,
      (SELECT COUNT(*) FROM SecurityIpBlocklist WHERE IsActive = 1 AND (ExpiresAt IS NULL OR ExpiresAt > SYSUTCDATETIME())) AS BlockedIps,
      (SELECT COUNT(*) FROM DeviceSecurityStatus WHERE FirewallEnabled = 0) AS FirewallOff,
      (SELECT COUNT(*) FROM DeviceSecurityStatus WHERE AntivirusStatus IS NOT NULL AND AntivirusStatus NOT IN ('Enabled', 'enabled', 'Running', 'running')) AS AvDisabled
  `);
  const r = result.recordset[0];

  return {
    overallScore,
    criticalAlerts: r.CriticalAlerts,
    blockedIps: r.BlockedIps,
    vulnerabilitiesBySeverity: counts.vulnerabilities,
    devicesWithFirewallOff: r.FirewallOff,
    devicesWithAvDisabled: r.AvDisabled,
  };
}

export interface RemoteAccessSummary {
  activeSessions: number;
  pendingApprovalRequests: number;
  avgSessionDurationMinutes: number | null;
  recentSessions: { targetHost: string; protocol: string; startedByUsername: string | null; startedAt: string; status: string }[];
}

export async function getRemoteAccessSummary(): Promise<RemoteAccessSummary> {
  const db = await getDb();
  const counts = await db.query<{ ActiveSessions: number; PendingRequests: number; AvgDurationSeconds: number | null }>(`
    SELECT
      (SELECT COUNT(*) FROM RemoteSessions WHERE Status = 'Active') AS ActiveSessions,
      (SELECT COUNT(*) FROM RemoteApprovalRequests WHERE Status = 'Pending') AS PendingRequests,
      (SELECT AVG(DATEDIFF(SECOND, StartedAt, EndedAt)) FROM RemoteSessions WHERE EndedAt IS NOT NULL AND StartedAt >= DATEADD(DAY, -7, SYSUTCDATETIME())) AS AvgDurationSeconds
  `);
  const recent = await db.query<{ TargetHost: string; Protocol: string; StartedByUsername: string | null; StartedAt: string; Status: string }>(`
    SELECT TOP 5 TargetHost, Protocol, StartedByUsername, CONVERT(VARCHAR(19), StartedAt, 126) AS StartedAt, Status
    FROM RemoteSessions ORDER BY StartedAt DESC
  `);
  const r = counts.recordset[0];
  return {
    activeSessions: r.ActiveSessions,
    pendingApprovalRequests: r.PendingRequests,
    avgSessionDurationMinutes: r.AvgDurationSeconds != null ? Math.round(r.AvgDurationSeconds / 60) : null,
    recentSessions: recent.recordset.map((s) => ({
      targetHost: s.TargetHost,
      protocol: s.Protocol,
      startedByUsername: s.StartedByUsername,
      startedAt: s.StartedAt,
      status: s.Status,
    })),
  };
}

export interface ItAssetSummary {
  totalActiveAssets: number;
  assignedAssets: number;
  availableAssets: number;
  warrantyExpiringSoon: number;
  licencesExpiringSoon: number;
  assetsNotCheckedRecently: number;
}

export async function getItAssetSummary(): Promise<ItAssetSummary> {
  const db = await getDb();
  const stats = await getItAssetDashboardStats();
  const extra = await db.query<{ Assigned: number; Available: number; WarrantyExpiringSoon: number }>(`
    SELECT
      (SELECT COUNT(*) FROM Assets WHERE IsDeleted = 0 AND AssignedUser IS NOT NULL) AS Assigned,
      (SELECT COUNT(*) FROM Assets WHERE IsDeleted = 0 AND AssignedUser IS NULL AND Status = 'Active') AS Available,
      (SELECT COUNT(*) FROM Assets WHERE IsDeleted = 0 AND WarrantyExpiryDate IS NOT NULL AND WarrantyExpiryDate BETWEEN CAST(SYSUTCDATETIME() AS DATE) AND DATEADD(DAY, 30, CAST(SYSUTCDATETIME() AS DATE))) AS WarrantyExpiringSoon
  `);
  const e = extra.recordset[0];
  return {
    totalActiveAssets: stats.TotalActiveAssets ?? 0,
    assignedAssets: e.Assigned,
    availableAssets: e.Available,
    warrantyExpiringSoon: e.WarrantyExpiringSoon,
    licencesExpiringSoon: stats.LicencesExpiringSoon ?? 0,
    assetsNotCheckedRecently: stats.AssetsNotCheckedRecently ?? 0,
  };
}

export interface BrowserActivitySummary {
  topDomains: { domain: string; categoryName: string | null; riskLevel: string | null; visitCount: number }[];
  securityEventCount: number;
  activeDevices24h: number;
}

export async function getBrowserActivitySummary(): Promise<BrowserActivitySummary> {
  const db = await getDb();
  const dateTo = new Date();
  const dateFrom = new Date(dateTo.getTime() - 24 * 3600 * 1000);
  const stats = await getBrowserActivityDashboardStats(dateFrom, dateTo);
  const activeDevices = await db
    .request()
    .input("dateFrom", sql.DateTime2, dateFrom)
    .query<{ Cnt: number }>("SELECT COUNT(DISTINCT DeviceId) AS Cnt FROM BrowserActivityEvents WHERE VisitedAt >= @dateFrom");

  const topDomains = stats.topDomains as { Domain: string; CategoryName: string | null; RiskLevel: string | null; VisitCount: number }[];

  return {
    topDomains: topDomains
      .slice(0, 5)
      .map((d) => ({ domain: d.Domain, categoryName: d.CategoryName, riskLevel: d.RiskLevel, visitCount: d.VisitCount })),
    securityEventCount: stats.securityEventCount,
    activeDevices24h: activeDevices.recordset[0]?.Cnt ?? 0,
  };
}

export interface WebsiteManagementSummary {
  total: number;
  live: number;
  staging: number;
  dev: number;
  enabled: number;
}

export async function getWebsiteManagementSummary(): Promise<WebsiteManagementSummary> {
  const db = await getDb();
  const result = await db.query<{ Total: number; Live: number; Staging: number; Dev: number; Enabled: number }>(`
    SELECT
      COUNT(*) AS Total,
      SUM(CASE WHEN Environment = 'Live' THEN 1 ELSE 0 END) AS Live,
      SUM(CASE WHEN Environment = 'Staging' THEN 1 ELSE 0 END) AS Staging,
      SUM(CASE WHEN Environment = 'Dev' THEN 1 ELSE 0 END) AS Dev,
      SUM(CASE WHEN Enabled = 1 THEN 1 ELSE 0 END) AS Enabled
    FROM Websites
  `);
  const r = result.recordset[0];
  return { total: r.Total, live: r.Live ?? 0, staging: r.Staging ?? 0, dev: r.Dev ?? 0, enabled: r.Enabled ?? 0 };
}

export interface MonitoringSummary {
  websitesUp: number;
  websitesDown: number;
  apisUp: number;
  apisDown: number;
  avgResponseMs: number | null;
  errorRatePct: number | null;
}

export async function getMonitoringSummary(): Promise<MonitoringSummary> {
  const db = await getDb();
  const statusResult = await db.query<{ MonitorType: string; Status: string; Cnt: number }>(`
    SELECT MonitorType, Status, COUNT(*) AS Cnt FROM Monitors WHERE IsActive = 1 GROUP BY MonitorType, Status
  `);
  const perfResult = await db.query<{ AvgMs: number | null; ErrorRate: number | null }>(`
    SELECT AVG(CAST(TotalMs AS FLOAT)) AS AvgMs, AVG(CASE WHEN Success = 0 THEN 1.0 ELSE 0.0 END) * 100 AS ErrorRate
    FROM MonitorResults WHERE CheckedAt >= DATEADD(HOUR, -24, SYSUTCDATETIME())
  `);

  let websitesUp = 0, websitesDown = 0, apisUp = 0, apisDown = 0;
  for (const row of statusResult.recordset) {
    const isUp = row.Status === "Up";
    if (row.MonitorType === "Website") {
      if (isUp) websitesUp += row.Cnt;
      else websitesDown += row.Cnt;
    } else if (row.MonitorType === "Api") {
      if (isUp) apisUp += row.Cnt;
      else apisDown += row.Cnt;
    }
  }
  const p = perfResult.recordset[0];
  return {
    websitesUp,
    websitesDown,
    apisUp,
    apisDown,
    avgResponseMs: p?.AvgMs != null ? Math.round(p.AvgMs) : null,
    errorRatePct: p?.ErrorRate != null ? Math.round(p.ErrorRate * 10) / 10 : null,
  };
}

export interface AutomationSummary {
  scheduledJobs: number;
  running: number;
  failed7d: number;
  success7d: number;
  successRatePct: number | null;
}

export async function getAutomationSummary(): Promise<AutomationSummary> {
  const db = await getDb();
  const result = await db.query<{ ScheduledJobs: number; Running: number; Failed7d: number; Success7d: number }>(`
    SELECT
      (SELECT COUNT(*) FROM AutomationSchedules WHERE IsActive = 1 AND IsDeleted = 0) AS ScheduledJobs,
      (SELECT COUNT(*) FROM AutomationJobTargets WHERE Status = 'Running') AS Running,
      (SELECT COUNT(*) FROM AutomationJobTargets t JOIN AutomationJobs j ON j.Id = t.JobId
        WHERE t.Status IN ('Failed','TimedOut','Error') AND j.CreatedAt >= DATEADD(DAY, -7, SYSUTCDATETIME())) AS Failed7d,
      (SELECT COUNT(*) FROM AutomationJobTargets t JOIN AutomationJobs j ON j.Id = t.JobId
        WHERE t.Status = 'Success' AND j.CreatedAt >= DATEADD(DAY, -7, SYSUTCDATETIME())) AS Success7d
  `);
  const r = result.recordset[0];
  const totalFinished = r.Failed7d + r.Success7d;
  return {
    scheduledJobs: r.ScheduledJobs,
    running: r.Running,
    failed7d: r.Failed7d,
    success7d: r.Success7d,
    successRatePct: totalFinished > 0 ? Math.round((r.Success7d / totalFinished) * 1000) / 10 : null,
  };
}

export interface AdministrationSummary {
  lastBackupStatus: string | null;
  lastBackupAt: string | null;
  serversWithRebootPending: number;
  serversStale90d: number;
  auditLogCountToday: number;
}

export async function getAdministrationSummary(): Promise<AdministrationSummary> {
  const db = await getDb();
  const backup = await db.query<{ Status: string; CreatedAt: string }>(
    "SELECT TOP 1 Status, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt FROM BackupHistory ORDER BY CreatedAt DESC"
  );
  // "Today" is Nepal-local (UTC+5:45), not UTC - CreatedAt is stored in UTC (SYSUTCDATETIME()),
  // so a raw `CAST(SYSUTCDATETIME() AS DATE)` boundary is wrong for the first ~5h45m of every
  // Nepal-calendar day. Shift by +345 minutes to compute today's date in Nepal-local terms, then
  // shift that date back by -345 minutes to get the actual UTC instant of Nepal midnight.
  const rest = await db.query<{ RebootPending: number; Stale90d: number; AuditToday: number }>(`
    SELECT
      (SELECT COUNT(*) FROM Devices WHERE DeviceType = 'Server' AND RebootPending = 1) AS RebootPending,
      (SELECT COUNT(*) FROM Devices WHERE DeviceType = 'Server' AND (LastWindowsUpdateAt IS NULL OR LastWindowsUpdateAt < DATEADD(DAY, -90, SYSUTCDATETIME()))) AS Stale90d,
      (SELECT COUNT(*) FROM AdminAuditLog WHERE CreatedAt >= DATEADD(MINUTE, -345, CAST(CAST(DATEADD(MINUTE, 345, SYSUTCDATETIME()) AS DATE) AS DATETIME2))) AS AuditToday
  `);
  const r = rest.recordset[0];
  return {
    lastBackupStatus: backup.recordset[0]?.Status ?? null,
    lastBackupAt: backup.recordset[0]?.CreatedAt ?? null,
    serversWithRebootPending: r.RebootPending,
    serversStale90d: r.Stale90d,
    auditLogCountToday: r.AuditToday,
  };
}

export interface ActivityFeedEntry {
  username: string | null;
  section: string;
  action: string;
  details: string | null;
  createdAt: string;
}

export async function getActivityFeed(limit = 20): Promise<ActivityFeedEntry[]> {
  const db = await getDb();
  const result = await db.query<{ Username: string | null; Section: string; Action: string; Details: string | null; CreatedAt: string }>(`
    SELECT TOP ${Math.min(50, Math.max(1, limit))} Username, Section, Action, Details, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
    FROM AdminAuditLog ORDER BY CreatedAt DESC
  `);
  return result.recordset.map((r) => ({ username: r.Username, section: r.Section, action: r.Action, details: r.Details, createdAt: r.CreatedAt }));
}

export interface NotificationsSummary {
  unreadCount: number;
  activeMaintenanceWindows: { name: string; startsAt: string; endsAt: string }[];
}

export async function getNotificationsSummary(userId: number): Promise<NotificationsSummary> {
  const db = await getDb();
  const unread = await db
    .request()
    .input("userId", sql.Int, userId)
    .query<{ Cnt: number }>("SELECT COUNT(*) AS Cnt FROM InAppNotifications WHERE UserId = @userId AND IsRead = 0");
  const windows = await db.query<{ Name: string; StartsAt: string; EndsAt: string }>(`
    SELECT TOP 5 Name, CONVERT(VARCHAR(19), StartsAt, 126) AS StartsAt, CONVERT(VARCHAR(19), EndsAt, 126) AS EndsAt
    FROM MaintenanceWindows WHERE IsActive = 1 AND EndsAt >= SYSUTCDATETIME() ORDER BY StartsAt ASC
  `);
  return {
    unreadCount: unread.recordset[0]?.Cnt ?? 0,
    activeMaintenanceWindows: windows.recordset.map((w) => ({ name: w.Name, startsAt: w.StartsAt, endsAt: w.EndsAt })),
  };
}

export interface PatchStatusSummary {
  criticalPatchesPending: number;
  failedPatchInstallations: number;
  serversWithRebootPending: number;
}

export async function getPatchStatusSummary(): Promise<PatchStatusSummary> {
  const db = await getDb();
  const itaStats = await getItAssetDashboardStats();
  const rebootResult = await db.query<{ Cnt: number }>(
    "SELECT COUNT(*) AS Cnt FROM Devices WHERE DeviceType = 'Server' AND RebootPending = 1"
  );
  return {
    criticalPatchesPending: itaStats.CriticalPatchesPending ?? 0,
    failedPatchInstallations: itaStats.FailedPatchInstallations ?? 0,
    serversWithRebootPending: rebootResult.recordset[0]?.Cnt ?? 0,
  };
}

export interface RecentIncident {
  title: string;
  severity: string;
  status: string;
  startedAt: string;
  resolvedAt: string | null;
}

export async function getRecentIncidents(limit = 5): Promise<RecentIncident[]> {
  const db = await getDb();
  const result = await db.query<{ Title: string; Severity: string; Status: string; StartedAt: string; ResolvedAt: string | null }>(`
    SELECT TOP ${Math.min(20, Math.max(1, limit))} Title, Severity, Status,
      CONVERT(VARCHAR(19), StartedAt, 126) AS StartedAt, CONVERT(VARCHAR(19), ResolvedAt, 126) AS ResolvedAt
    FROM Incidents ORDER BY StartedAt DESC
  `);
  return result.recordset.map((r) => ({ title: r.Title, severity: r.Severity, status: r.Status, startedAt: r.StartedAt, resolvedAt: r.ResolvedAt }));
}

export interface ConnectedDevice {
  mac: string;
  ip: string;
  hostname: string | null;
  vendorName: string | null;
  source: "MikroTik" | "Sophos";
}

// Devices currently online right now, combined from both network sources (MikroTik
// RouterClients + Sophos ARP-walk SophosClients) and deduped by MAC - same "recently
// polled" freshness window (90s = 3x the 30s poll interval) as the Overview KPI's
// ConnectedNow count, so this list always agrees with that number. A device that's
// reported by both sources keeps only its most-recently-updated row (ROW_NUMBER over
// Mac). Nothing that has gone stale/disconnected is ever included - there's no
// separate "offline" state here by design, matching the "remove from the list the
// moment it disconnects" requirement.
export async function getConnectedDevices(limit = 20): Promise<ConnectedDevice[]> {
  const db = await getDb();
  const result = await db.query<{ Mac: string; IpAddress: string; Hostname: string | null; VendorName: string | null; Source: "MikroTik" | "Sophos" }>(`
    WITH combined AS (
      SELECT UPPER(rc.MacAddress) AS Mac, rc.IpAddress, rc.Hostname, rc.UpdatedAt, 'MikroTik' AS Source
      FROM RouterClients rc
      WHERE rc.MacAddress IS NOT NULL AND rc.Status = 'bound' AND rc.UpdatedAt >= DATEADD(SECOND, -90, SYSUTCDATETIME())
      UNION ALL
      SELECT UPPER(sc.MacAddress) AS Mac, sc.IpAddress, sc.Hostname, sc.UpdatedAt, 'Sophos' AS Source
      FROM SophosClients sc
      WHERE sc.MacAddress IS NOT NULL AND sc.UpdatedAt >= DATEADD(SECOND, -90, SYSUTCDATETIME())
    ), ranked AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY Mac ORDER BY UpdatedAt DESC) AS rn
      FROM combined
    )
    SELECT TOP ${Math.min(100, Math.max(1, limit))} r.Mac, r.IpAddress, r.Hostname, r.Source, ov.VendorName
    FROM ranked r
    LEFT JOIN OuiVendors ov ON ov.Prefix = REPLACE(LEFT(r.Mac, 8), ':', '')
    WHERE r.rn = 1
    ORDER BY r.UpdatedAt DESC
  `);
  return result.recordset.map((r) => ({
    mac: r.Mac,
    ip: r.IpAddress,
    hostname: r.Hostname,
    vendorName: r.VendorName,
    source: r.Source,
  }));
}

export interface WifiUser {
  name: string | null;
  mac: string;
  ip: string;
  source: "MikroTik" | "Sophos";
}

// Same combined MikroTik+Sophos, deduped-by-MAC, 90s-freshness query as getConnectedDevices
// above, but resolved to a staff Name (via the same MAC/IP-to-Staff maps the bandwidth widgets
// use) instead of device hostname/vendor - this is the "who is currently on the network" view,
// not the "what device is this" view. Widening this window does NOT help MikroTik coverage
// (confirmed live: poll-router-clients.ts's persistent poll loop logs "Polled 28 router client
// leases" every ~30s and unconditionally MERGEs UpdatedAt=SYSUTCDATETIME() for every lease line,
// yet RouterClients.UpdatedAt for most rows stays stale for hours regardless of window size) -
// that's a separate, pre-existing write-path bug in the poller itself (logs success but most
// MERGEs apparently aren't landing), not something a wider SELECT-side window can paper over.
// A client re-fetches this on its own interval (see WifiUsersCard), so "real-time" means the
// query runs fresh on every fetch, not that this function itself pushes updates.
// Wireless-vs-wired detection is a TTL-based OS-family fingerprint computed at ingest time
// (classifyOS() in poll-router-clients.ts / the Sophos client poller), not a true "connected
// via WiFi radio" signal - it only distinguishes OS kernel family (Windows TTL=128 vs
// Linux/macOS/mobile TTL=64), so it's a proxy, not a guarantee. Restricting to
// Android/macOS/"Linux/macOS/Mobile" (laptop/phone-shaped fingerprints) and excluding
// Windows/"Network Device"/Unknown/NULL is the closest available signal to "personal mobile
// device on WiFi" vs "wired desktop PC" - confirmed against this app's actual OS distribution
// (SophosClients: Unknown 97, Linux/macOS/Mobile 21, Windows 19, Network Device 9; RouterClients:
// Unknown 38, Android 9, Windows 7, Linux/macOS/Mobile 2, macOS 1). A real Windows laptop
// genuinely on WiFi will be excluded by this heuristic; there's no better signal recorded today.
const WIFI_LIKE_OS = ["Android", "macOS", "Linux/macOS/Mobile"];

export async function getWifiUsers(limit = 200): Promise<WifiUser[]> {
  const db = await getDb();
  const osList = WIFI_LIKE_OS.map((os) => `'${os}'`).join(", ");
  const excludedIpList = NON_STAFF_INFRASTRUCTURE_IPS.map((ip) => `'${ip}'`).join(", ");
  const [result, sophosNameByIp, routerNameByIp] = await Promise.all([
    db.query<{ Mac: string; IpAddress: string; Source: "MikroTik" | "Sophos" }>(`
      WITH combined AS (
        SELECT UPPER(rc.MacAddress) AS Mac, rc.IpAddress, rc.UpdatedAt, 'MikroTik' AS Source
        FROM RouterClients rc
        WHERE rc.MacAddress IS NOT NULL AND rc.Status = 'bound' AND rc.Os IN (${osList})
          AND rc.IpAddress NOT IN (${excludedIpList})
          AND rc.UpdatedAt >= DATEADD(SECOND, -90, SYSUTCDATETIME())
        UNION ALL
        SELECT UPPER(sc.MacAddress) AS Mac, sc.IpAddress, sc.UpdatedAt, 'Sophos' AS Source
        FROM SophosClients sc
        WHERE sc.MacAddress IS NOT NULL AND sc.Os IN (${osList})
          AND sc.IpAddress NOT IN (${excludedIpList})
          AND sc.UpdatedAt >= DATEADD(SECOND, -90, SYSUTCDATETIME())
      ), ranked AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY Mac ORDER BY UpdatedAt DESC) AS rn
        FROM combined
      )
      SELECT TOP ${Math.min(500, Math.max(1, limit))} Mac, IpAddress, Source
      FROM ranked WHERE rn = 1
      ORDER BY IpAddress
    `),
    getIpToStaffNameMap(),
    getIpToStaffNameMapViaRouter(),
  ]);

  return result.recordset.map((r) => ({
    name: (r.Source === "Sophos" ? sophosNameByIp.get(r.IpAddress) : routerNameByIp.get(r.IpAddress)) ?? null,
    mac: r.Mac,
    ip: r.IpAddress,
    source: r.Source,
  }));
}

export interface NetworkFirewallSummary {
  totalDevices: number;
  firewallOn: number;
  firewallOff: number;
  devicesOff: { deviceName: string | null; hostname: string }[];
}

export async function getNetworkFirewallSummary(): Promise<NetworkFirewallSummary> {
  const db = await getDb();
  const counts = await db.query<{ Total: number; On: number; Off: number }>(`
    SELECT COUNT(*) AS Total,
      SUM(CASE WHEN FirewallEnabled = 1 THEN 1 ELSE 0 END) AS [On],
      SUM(CASE WHEN FirewallEnabled = 0 THEN 1 ELSE 0 END) AS [Off]
    FROM DeviceSecurityStatus WHERE FirewallEnabled IS NOT NULL
  `);
  const offDevices = await db.query<{ DeviceName: string | null; Hostname: string }>(`
    SELECT TOP 5 d.DeviceName, d.Hostname FROM DeviceSecurityStatus s
    JOIN Devices d ON d.DeviceId = s.DeviceId WHERE s.FirewallEnabled = 0
  `);
  const c = counts.recordset[0];
  return {
    totalDevices: c?.Total ?? 0,
    firewallOn: c?.On ?? 0,
    firewallOff: c?.Off ?? 0,
    devicesOff: offDevices.recordset.map((d) => ({ deviceName: d.DeviceName, hostname: d.Hostname })),
  };
}

// Relocated from the now-removed AI Assistant's tool functions (src/lib/aiAssistant/tools.ts) -
// the Overview dashboard's Offline Devices and Expiring SSL Certificates widgets (see
// ExtraWidgets.tsx) depended on these two directly, so they moved here rather than being
// deleted along with the rest of that feature.

// Same 90s heartbeat-staleness threshold as src/lib/remoteSupport/presence.ts's
// isDeviceOnline - not reused directly to avoid a cross-feature import for one constant, but
// must be kept in sync if that threshold ever changes.
const ONLINE_THRESHOLD_MS = 90 * 1000;

export async function getOfflineDevices(input: { withinDays?: number }) {
  const db = await getDb();
  const withinDays = Math.min(30, Math.max(1, input.withinDays ?? 7));
  const result = await db
    .request()
    .input("withinDays", sql.Int, withinDays)
    .query<{ DeviceName: string | null; Hostname: string; DeviceType: string; LastHeartbeat: string | null; EnrolledAt: string }>(`
      SELECT DeviceName, Hostname, DeviceType, CONVERT(VARCHAR(19), LastHeartbeat, 126) AS LastHeartbeat,
        CONVERT(VARCHAR(19), EnrolledAt, 126) AS EnrolledAt
      FROM Devices
      WHERE LastHeartbeat IS NULL OR LastHeartbeat < DATEADD(SECOND, -90, SYSUTCDATETIME())
      ORDER BY LastHeartbeat DESC
    `);
  // A device that has NEVER sent a heartbeat (pre-created via Add Server, agent not installed
  // yet) has no LastHeartbeat to measure against - falling back to EnrolledAt here means it
  // still ages out of this list after withinDays, same as every other entry, instead of being
  // permanently exempt from the window and lingering forever regardless of how old the
  // placeholder record is.
  const now = Date.now();
  return result.recordset
    .filter((r) => {
      const referenceTime = r.LastHeartbeat ?? r.EnrolledAt;
      return !referenceTime || now - new Date(referenceTime).getTime() <= withinDays * 86400000;
    })
    .map((r) => ({
      device: r.DeviceName ?? r.Hostname,
      type: r.DeviceType,
      lastHeartbeat: r.LastHeartbeat,
      currentlyOffline: !r.LastHeartbeat || now - new Date(r.LastHeartbeat).getTime() >= ONLINE_THRESHOLD_MS,
    }));
}

export interface ServerStatusRow {
  deviceId: string;
  name: string;
  hostname: string;
  serverRole: string | null;
  isOnline: boolean;
  lastHeartbeat: string | null;
}

// Every registered server (web, database, or any other ServerRole - same Devices rows the
// /dashboard/servers page and its "Add Server" flow manage), offline ones sorted first so
// they aren't buried below a long list of healthy servers. "Online" uses the same 10-minute
// LastHeartbeat threshold as getQuickStats' OnlineServers count above, so this widget's online
// count agrees with that one - computed in SQL rather than re-parsed from the truncated
// VARCHAR(19) timestamp in JS, to avoid a timezone-parsing mismatch on the online/offline
// decision itself (the raw LastHeartbeat string is only used for display).
export async function getAllServers(): Promise<ServerStatusRow[]> {
  const db = await getDb();
  const result = await db.query<{
    DeviceId: string;
    DeviceName: string | null;
    Hostname: string;
    ServerRole: string | null;
    LastHeartbeat: string | null;
    IsOnline: boolean;
  }>(`
    SELECT DeviceId, DeviceName, Hostname, ServerRole,
      CONVERT(VARCHAR(19), LastHeartbeat, 126) AS LastHeartbeat,
      CASE WHEN LastHeartbeat >= DATEADD(MINUTE, -10, SYSUTCDATETIME()) THEN 1 ELSE 0 END AS IsOnline
    FROM Devices
    WHERE DeviceType = 'Server'
    ORDER BY IsOnline ASC, DeviceName ASC, Hostname ASC
  `);
  return result.recordset.map((r) => ({
    deviceId: r.DeviceId,
    name: r.DeviceName ?? r.Hostname,
    hostname: r.Hostname,
    serverRole: r.ServerRole,
    isOnline: Boolean(r.IsOnline),
    lastHeartbeat: r.LastHeartbeat,
  }));
}

// Website/API monitors currently not "Up" (in practice just Down - a successful check is
// always "Up" regardless of response time, see monitorState.ts), for the Overview page's
// Offline Websites widget - Status/ConsecutiveFailures/LastCheckedAt live on Monitors itself
// (kept current by the monitor-check background job), while the URL lives on the separate
// per-type config table (WebsiteMonitorConfigs) and the human-readable reason for the most
// recent failure comes from MonitorResults - same join pattern getMonitoringSummary above
// already relies on for its up/down counts, just resolved down to individual site detail here.
export interface OfflineWebsite {
  id: number;
  name: string;
  url: string | null;
  status: string;
  consecutiveFailures: number;
  lastCheckedAt: string | null;
  httpStatusCode: number | null;
  lastError: string | null;
}

export async function getOfflineWebsites(): Promise<OfflineWebsite[]> {
  const db = await getDb();
  const result = await db.query<{
    Id: number;
    Name: string;
    Url: string | null;
    Status: string;
    ConsecutiveFailures: number;
    LastCheckedAt: string | null;
    HttpStatusCode: number | null;
    ErrorMessage: string | null;
  }>(`
    SELECT m.Id, m.Name, c.Url, m.Status, m.ConsecutiveFailures,
      CONVERT(VARCHAR(19), m.LastCheckedAt, 126) AS LastCheckedAt,
      r.HttpStatusCode, r.ErrorMessage
    FROM Monitors m
    LEFT JOIN WebsiteMonitorConfigs c ON c.MonitorId = m.Id
    OUTER APPLY (
      SELECT TOP 1 HttpStatusCode, ErrorMessage FROM MonitorResults WHERE MonitorId = m.Id ORDER BY CheckedAt DESC
    ) r
    WHERE m.IsActive = 1 AND m.IsDeleted = 0 AND m.MonitorType = 'Website' AND m.Status <> 'Up'
    ORDER BY CASE m.Status WHEN 'Down' THEN 0 ELSE 1 END, m.LastCheckedAt DESC
  `);
  return result.recordset.map((r) => ({
    id: r.Id,
    name: r.Name,
    url: r.Url,
    status: r.Status,
    consecutiveFailures: r.ConsecutiveFailures,
    lastCheckedAt: r.LastCheckedAt,
    httpStatusCode: r.HttpStatusCode,
    lastError: r.ErrorMessage,
  }));
}

// Reads from WebsiteSslStatus, a cache populated by the scheduled
// scripts/check-website-ssl-expiry.ts background check against every enabled site in the
// Website Management list (Websites table) - NOT IisSites (agent-reported IIS bindings on
// enrolled servers), which only covered a handful of internal sites and went stale whenever
// an agent didn't report in, not the actual public website list this widget is meant to
// reflect. A live TLS check per site on every page load would be too slow (93 sites x a
// live handshake each), hence the cache + periodic background refresh instead.
export async function getExpiringSslCertificates(input: { withinDays?: number }) {
  const db = await getDb();
  const withinDays = Math.min(180, Math.max(1, input.withinDays ?? 30));
  const result = await db
    .request()
    .input("withinDays", sql.Int, withinDays)
    .query<{ Name: string; ExpiresAt: string | null }>(`
      SELECT w.Name, CONVERT(VARCHAR(19), s.ExpiresAt, 126) AS ExpiresAt
      FROM WebsiteSslStatus s
      JOIN Websites w ON w.Id = s.WebsiteId
      WHERE s.ExpiresAt IS NOT NULL AND s.ExpiresAt <= DATEADD(DAY, @withinDays, SYSUTCDATETIME())
      ORDER BY s.ExpiresAt ASC
    `);
  return result.recordset.map((r) => ({
    server: null,
    site: r.Name,
    expiresAt: r.ExpiresAt,
    alreadyExpired: r.ExpiresAt ? new Date(r.ExpiresAt).getTime() < Date.now() : false,
  }));
}

export interface DomainExpiryRow {
  domain: string;
  siteNames: string;
  registrar: string | null;
  expiresAt: string | null;
  alreadyExpired: boolean;
  noData: boolean;
}

// Reads from WebsiteDomainStatus, a cache populated by the scheduled
// scripts/check-website-domain-expiry.ts background WHOIS check against every enabled,
// Live-environment site in the Website Management list (the "live website list") - a real
// WHOIS query per page load (94 sites x a port-43 round trip each, several registries also
// needing an IANA bootstrap + registrar referral hop) would be far too slow and would trip
// registry rate limits, hence the cache + periodic background refresh, same pattern as
// getExpiringSslCertificates above. Keyed by registrable domain rather than WebsiteId since
// several Website rows are subdomains of the same registration (e.g. jetty.se / cms.jetty.se
// / my.jetty.se) and only need one WHOIS lookup between them - SiteNames carries which sites
// share that domain. Some registries (notably Sweden's .se) never publish an expiry date in
// WHOIS at all - those rows have ExpiresAt = NULL and are surfaced separately (noData) rather
// than silently dropped, so "no data available" is distinguishable from "not expiring soon."
export async function getExpiringDomains(input: { withinDays?: number }): Promise<DomainExpiryRow[]> {
  const db = await getDb();
  const withinDays = Math.min(180, Math.max(1, input.withinDays ?? 30));
  const result = await db
    .request()
    .input("withinDays", sql.Int, withinDays)
    .query<{ Domain: string; SiteNames: string; Registrar: string | null; ExpiresAt: string | null; ErrorMessage: string | null }>(`
      SELECT Domain, SiteNames, Registrar, CONVERT(VARCHAR(19), ExpiresAt, 126) AS ExpiresAt, ErrorMessage
      FROM WebsiteDomainStatus
      WHERE (ExpiresAt IS NOT NULL AND ExpiresAt <= DATEADD(DAY, @withinDays, SYSUTCDATETIME()))
         OR (ExpiresAt IS NULL AND ErrorMessage IS NULL)
      ORDER BY CASE WHEN ExpiresAt IS NULL THEN 1 ELSE 0 END, ExpiresAt ASC
    `);
  return result.recordset.map((r) => ({
    domain: r.Domain,
    siteNames: r.SiteNames,
    registrar: r.Registrar,
    expiresAt: r.ExpiresAt,
    alreadyExpired: r.ExpiresAt ? new Date(r.ExpiresAt).getTime() < Date.now() : false,
    noData: r.ExpiresAt === null,
  }));
}


