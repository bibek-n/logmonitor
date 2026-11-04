import { getDb, sql } from "@/lib/db";
import { matchAppCategoryRule } from "./classifyProcess";
import type {
  AppCategory,
  AppCategoryRule,
  AppActivitySettingsData,
  AppUsageSessionRow,
  AppActivityFilter,
  AppRiskLevel,
  AgentStatusRow,
} from "./types";

// --- Settings (singleton row, Id = 1 - same pattern as BrowserActivitySettings) --------------

export async function getAppActivitySettings(): Promise<AppActivitySettingsData> {
  const db = await getDb();
  const result = await db.query<{
    IdleTimeoutSeconds: number;
    CollectWindowTitles: boolean;
    RetentionDays: number;
    ExcludedProcessNamesJson: string | null;
  }>("SELECT IdleTimeoutSeconds, CollectWindowTitles, RetentionDays, ExcludedProcessNamesJson FROM AppActivitySettings WHERE Id = 1");
  const row = result.recordset[0];
  let excludedProcessNames: string[] = [];
  if (row?.ExcludedProcessNamesJson) {
    try {
      const parsed = JSON.parse(row.ExcludedProcessNamesJson);
      if (Array.isArray(parsed)) excludedProcessNames = parsed.filter((v): v is string => typeof v === "string");
    } catch {
      // Malformed JSON should never block the page from rendering - fall back to empty.
    }
  }
  return {
    idleTimeoutSeconds: row?.IdleTimeoutSeconds ?? 300,
    collectWindowTitles: row?.CollectWindowTitles ?? false,
    retentionDays: row?.RetentionDays ?? 90,
    excludedProcessNames,
  };
}

export async function updateAppActivitySettings(patch: Partial<AppActivitySettingsData>, updatedByUserId: number): Promise<void> {
  const current = await getAppActivitySettings();
  const merged: AppActivitySettingsData = { ...current, ...patch };
  const db = await getDb();
  await db
    .request()
    .input("idleTimeoutSeconds", sql.Int, merged.idleTimeoutSeconds)
    .input("collectWindowTitles", sql.Bit, merged.collectWindowTitles)
    .input("retentionDays", sql.Int, merged.retentionDays)
    .input("excludedProcessNamesJson", sql.NVarChar(sql.MAX), JSON.stringify(merged.excludedProcessNames))
    .input("updatedByUserId", sql.Int, updatedByUserId)
    .query(`
      UPDATE AppActivitySettings
      SET IdleTimeoutSeconds = @idleTimeoutSeconds, CollectWindowTitles = @collectWindowTitles,
        RetentionDays = @retentionDays, ExcludedProcessNamesJson = @excludedProcessNamesJson,
        UpdatedByUserId = @updatedByUserId, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = 1
    `);
}

// --- Categories --------------------------------------------------------------------------------

function mapCategory(r: Record<string, unknown>): AppCategory {
  return { id: r.Id as number, name: r.Name as string, riskLevel: r.RiskLevel as AppRiskLevel, isBuiltIn: r.IsBuiltIn as boolean };
}

export async function listAppCategories(): Promise<AppCategory[]> {
  const db = await getDb();
  const result = await db.query`SELECT * FROM AppCategories ORDER BY Name ASC`;
  return result.recordset.map(mapCategory);
}

export async function createAppCategory(data: { name: string; riskLevel: AppRiskLevel }): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("name", sql.NVarChar, data.name)
    .input("riskLevel", sql.VarChar, data.riskLevel)
    .query<{ Id: number }>("INSERT INTO AppCategories (Name, RiskLevel) OUTPUT INSERTED.Id VALUES (@name, @riskLevel)");
  return result.recordset[0].Id;
}

export async function updateAppCategory(id: number, data: { name?: string; riskLevel?: AppRiskLevel }): Promise<void> {
  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, id).query<{ Name: string; RiskLevel: AppRiskLevel }>(
    "SELECT Name, RiskLevel FROM AppCategories WHERE Id = @id"
  );
  const current = existing.recordset[0];
  if (!current) return;
  await db
    .request()
    .input("id", sql.Int, id)
    .input("name", sql.NVarChar, data.name ?? current.Name)
    .input("riskLevel", sql.VarChar, data.riskLevel ?? current.RiskLevel)
    .query("UPDATE AppCategories SET Name = @name, RiskLevel = @riskLevel, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");
}

export async function deleteAppCategory(id: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).query("DELETE FROM AppCategories WHERE Id = @id AND IsBuiltIn = 0");
}

// --- Category rules ------------------------------------------------------------------------------

function mapCategoryRule(r: Record<string, unknown>): AppCategoryRule {
  return {
    id: r.Id as number,
    processName: r.ProcessName as string,
    categoryId: r.CategoryId as number,
    matchType: r.MatchType as AppCategoryRule["matchType"],
    source: r.Source as AppCategoryRule["source"],
  };
}

export async function listAppCategoryRules(): Promise<(AppCategoryRule & { categoryName: string })[]> {
  const db = await getDb();
  const result = await db.query`
    SELECT r.*, c.Name AS CategoryName FROM AppCategoryRules r JOIN AppCategories c ON c.Id = r.CategoryId ORDER BY r.ProcessName ASC
  `;
  return result.recordset.map((r: Record<string, unknown>) => ({ ...mapCategoryRule(r), categoryName: r.CategoryName as string }));
}

export async function createAppCategoryRule(data: {
  processName: string;
  categoryId: number;
  matchType: "exact" | "contains";
  createdByUserId: number;
}): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("processName", sql.NVarChar, data.processName)
    .input("categoryId", sql.Int, data.categoryId)
    .input("matchType", sql.VarChar, data.matchType)
    .input("createdByUserId", sql.Int, data.createdByUserId)
    .query<{ Id: number }>(`
      INSERT INTO AppCategoryRules (ProcessName, CategoryId, MatchType, Source, CreatedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@processName, @categoryId, @matchType, 'manual', @createdByUserId)
    `);
  return result.recordset[0].Id;
}

export async function deleteAppCategoryRule(id: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).query("DELETE FROM AppCategoryRules WHERE Id = @id");
}

// Applies the current rule set to (re)assign CategoryId on already-stored sessions whose
// ProcessName matches - mirrors the Browser Activity backfill pattern used repeatedly this
// session, exposed here so the categories API can trigger it after a rule change instead of
// leaving historical sessions permanently uncategorized.
export async function backfillSessionCategories(): Promise<{ sessionsChanged: number }> {
  const db = await getDb();
  const rulesRaw = await db.query`SELECT * FROM AppCategoryRules`;
  const rules = rulesRaw.recordset.map(mapCategoryRule);
  const distinctProcesses = await db.query<{ ProcessName: string; CategoryId: number | null }>(`
    SELECT DISTINCT ProcessName, CategoryId FROM AppUsageSessions
  `);

  let sessionsChanged = 0;
  for (const row of distinctProcesses.recordset) {
    const matched = matchAppCategoryRule(row.ProcessName, rules);
    const newCategoryId = matched?.categoryId ?? null;
    if (newCategoryId === row.CategoryId) continue;
    const result = await db
      .request()
      .input("processName", sql.NVarChar, row.ProcessName)
      .input("oldCategoryId", sql.Int, row.CategoryId)
      .input("newCategoryId", sql.Int, newCategoryId)
      .query(`
        UPDATE AppUsageSessions SET CategoryId = @newCategoryId
        WHERE ProcessName = @processName AND (CategoryId = @oldCategoryId OR (@oldCategoryId IS NULL AND CategoryId IS NULL))
      `);
    sessionsChanged += (result as unknown as { rowsAffected: number[] }).rowsAffected?.[0] ?? 0;
  }
  return { sessionsChanged };
}

// --- Sessions list (staff-wise report) ----------------------------------------------------------

// Floored at 0 - LastSeenAt can land a few hundred ms *before* StartedAt for a session
// discovered in its very first snapshot (the agent's own StartedAt estimate vs. snapshot
// receipt time aren't perfectly ordered), which would otherwise DATEDIFF to a small negative
// number rather than the ~0 it actually represents.
const RUNNING_DURATION_EXPR = "CASE WHEN DATEDIFF(SECOND, a.StartedAt, ISNULL(a.EndedAt, a.LastSeenAt)) < 0 THEN 0 ELSE DATEDIFF(SECOND, a.StartedAt, ISNULL(a.EndedAt, a.LastSeenAt)) END";

export async function listAppUsageSessions(filter: AppActivityFilter): Promise<{ sessions: AppUsageSessionRow[]; total: number }> {
  const db = await getDb();
  const request = db.request();
  const countRequest = db.request();
  const conditions: string[] = [];

  if (filter.staffId !== undefined) {
    request.input("staffId", sql.Int, filter.staffId);
    countRequest.input("staffId", sql.Int, filter.staffId);
    conditions.push("a.StaffId = @staffId");
  }
  if (filter.deviceId) {
    request.input("deviceId", sql.VarChar, filter.deviceId);
    countRequest.input("deviceId", sql.VarChar, filter.deviceId);
    conditions.push("a.DeviceId = @deviceId");
  }
  if (filter.processName) {
    request.input("processName", sql.NVarChar, `%${filter.processName}%`);
    countRequest.input("processName", sql.NVarChar, `%${filter.processName}%`);
    conditions.push("a.ProcessName LIKE @processName");
  }
  if (filter.categoryId !== undefined) {
    request.input("categoryId", sql.Int, filter.categoryId);
    countRequest.input("categoryId", sql.Int, filter.categoryId);
    conditions.push("a.CategoryId = @categoryId");
  }
  if (filter.dateFrom) {
    request.input("dateFrom", sql.DateTime2, new Date(filter.dateFrom));
    countRequest.input("dateFrom", sql.DateTime2, new Date(filter.dateFrom));
    conditions.push("a.StartedAt >= @dateFrom");
  }
  if (filter.dateTo) {
    request.input("dateTo", sql.DateTime2, new Date(filter.dateTo));
    countRequest.input("dateTo", sql.DateTime2, new Date(filter.dateTo));
    conditions.push("a.StartedAt <= @dateTo");
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(200, filter.pageSize ?? 25);
  const offset = (page - 1) * pageSize;

  request.input("offset", sql.Int, offset).input("pageSize", sql.Int, pageSize);

  const [dataResult, countResult] = await Promise.all([
    request.query<{
      Id: number;
      DeviceId: string;
      Hostname: string;
      StaffId: number | null;
      StaffName: string | null;
      Department: string | null;
      ProcessName: string;
      ExePath: string | null;
      WindowTitle: string | null;
      StartedAt: string;
      LastSeenAt: string;
      EndedAt: string | null;
      RunningDurationSeconds: number;
      ActiveDurationSeconds: number | null;
      IdleDurationSeconds: number | null;
      CategoryId: number | null;
      CategoryName: string | null;
    }>(`
      SELECT a.Id, a.DeviceId, d.Hostname, a.StaffId, s.Name AS StaffName, s.Department,
        a.ProcessName, a.ExePath, a.WindowTitle, a.StartedAt, a.LastSeenAt, a.EndedAt,
        ${RUNNING_DURATION_EXPR} AS RunningDurationSeconds,
        a.ActiveDurationSeconds, a.IdleDurationSeconds, a.CategoryId, c.Name AS CategoryName
      FROM AppUsageSessions a
      JOIN Devices d ON d.DeviceId = a.DeviceId
      LEFT JOIN Staff s ON s.Id = a.StaffId
      LEFT JOIN AppCategories c ON c.Id = a.CategoryId
      ${where}
      ORDER BY a.StartedAt DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `),
    countRequest.query<{ Total: number }>(`SELECT COUNT(*) AS Total FROM AppUsageSessions a ${where}`),
  ]);

  const sessions: AppUsageSessionRow[] = dataResult.recordset.map((r) => ({
    id: r.Id,
    deviceId: r.DeviceId,
    hostname: r.Hostname,
    staffId: r.StaffId,
    staffName: r.StaffName,
    department: r.Department,
    processName: r.ProcessName,
    exePath: r.ExePath,
    windowTitle: r.WindowTitle,
    startedAt: r.StartedAt,
    lastSeenAt: r.LastSeenAt,
    endedAt: r.EndedAt,
    runningDurationSeconds: r.RunningDurationSeconds,
    activeDurationSeconds: r.ActiveDurationSeconds,
    idleDurationSeconds: r.IdleDurationSeconds,
    categoryId: r.CategoryId,
    categoryName: r.CategoryName,
  }));

  return { sessions, total: countResult.recordset[0]?.Total ?? 0 };
}

// --- Dashboard summary ---------------------------------------------------------------------------

export async function getAppActivityDashboardStats(dateFrom: Date, dateTo: Date) {
  const db = await getDb();
  const newRequest = () => db.request().input("dateFrom", sql.DateTime2, dateFrom).input("dateTo", sql.DateTime2, dateTo);

  const [summary, topApps, byCategory, dailyTrend] = await Promise.all([
    newRequest().query<{ StaffCount: number; DeviceCount: number; TotalRunningSeconds: number; TotalIdleSeconds: number }>(`
      SELECT COUNT(DISTINCT a.StaffId) AS StaffCount, COUNT(DISTINCT a.DeviceId) AS DeviceCount,
        SUM(${RUNNING_DURATION_EXPR}) AS TotalRunningSeconds, SUM(ISNULL(a.IdleDurationSeconds, 0)) AS TotalIdleSeconds
      FROM AppUsageSessions a WHERE a.StartedAt BETWEEN @dateFrom AND @dateTo
    `),
    newRequest().query(`
      SELECT TOP 15 a.ProcessName, c.Name AS CategoryName, COUNT(*) AS SessionCount,
        SUM(${RUNNING_DURATION_EXPR}) AS TotalRunningSeconds, SUM(ISNULL(a.ActiveDurationSeconds, 0)) AS TotalActiveSeconds
      FROM AppUsageSessions a LEFT JOIN AppCategories c ON c.Id = a.CategoryId
      WHERE a.StartedAt BETWEEN @dateFrom AND @dateTo
      GROUP BY a.ProcessName, c.Name ORDER BY TotalRunningSeconds DESC
    `),
    newRequest().query(`
      SELECT ISNULL(c.Name, 'Uncategorized') AS CategoryName, SUM(${RUNNING_DURATION_EXPR}) AS TotalRunningSeconds
      FROM AppUsageSessions a LEFT JOIN AppCategories c ON c.Id = a.CategoryId
      WHERE a.StartedAt BETWEEN @dateFrom AND @dateTo
      GROUP BY c.Name ORDER BY TotalRunningSeconds DESC
    `),
    newRequest().query(`
      SELECT CAST(a.StartedAt AS DATE) AS Day, COUNT(*) AS SessionCount
      FROM AppUsageSessions a WHERE a.StartedAt BETWEEN @dateFrom AND @dateTo
      GROUP BY CAST(a.StartedAt AS DATE) ORDER BY Day ASC
    `),
  ]);

  const s = summary.recordset[0];
  return {
    totalStaffMonitored: s?.StaffCount ?? 0,
    activeComputers: s?.DeviceCount ?? 0,
    totalUsageSeconds: s?.TotalRunningSeconds ?? 0,
    totalIdleSeconds: s?.TotalIdleSeconds ?? 0,
    topApplications: topApps.recordset,
    byCategory: byCategory.recordset,
    dailyTrend: dailyTrend.recordset,
  };
}

// --- Application-wise report ----------------------------------------------------------------------

export async function getByApplicationReport(dateFrom: Date, dateTo: Date) {
  const db = await getDb();
  const result = await db
    .request()
    .input("dateFrom", sql.DateTime2, dateFrom)
    .input("dateTo", sql.DateTime2, dateTo)
    .query(`
      SELECT a.ProcessName, c.Name AS CategoryName, COUNT(DISTINCT a.StaffId) AS UserCount, COUNT(*) AS SessionCount,
        SUM(${RUNNING_DURATION_EXPR}) AS TotalRunningSeconds, SUM(ISNULL(a.ActiveDurationSeconds, 0)) AS TotalActiveSeconds,
        SUM(ISNULL(a.IdleDurationSeconds, 0)) AS TotalIdleSeconds
      FROM AppUsageSessions a LEFT JOIN AppCategories c ON c.Id = a.CategoryId
      WHERE a.StartedAt BETWEEN @dateFrom AND @dateTo
      GROUP BY a.ProcessName, c.Name
      ORDER BY TotalRunningSeconds DESC
    `);
  return result.recordset;
}

// --- Employee-wise report -------------------------------------------------------------------------

export async function getByEmployeeReport(dateFrom: Date, dateTo: Date, staffId?: number) {
  const db = await getDb();
  const request = db.request().input("dateFrom", sql.DateTime2, dateFrom).input("dateTo", sql.DateTime2, dateTo);
  let staffFilter = "";
  if (staffId !== undefined) {
    request.input("staffId", sql.Int, staffId);
    staffFilter = "AND a.StaffId = @staffId";
  }
  const result = await request.query(`
    SELECT a.StaffId, s.Name AS StaffName, a.ProcessName, COUNT(*) AS SessionCount,
      SUM(${RUNNING_DURATION_EXPR}) AS TotalRunningSeconds, SUM(ISNULL(a.ActiveDurationSeconds, 0)) AS TotalActiveSeconds,
      SUM(ISNULL(a.IdleDurationSeconds, 0)) AS TotalIdleSeconds
    FROM AppUsageSessions a LEFT JOIN Staff s ON s.Id = a.StaffId
    WHERE a.StartedAt BETWEEN @dateFrom AND @dateTo AND a.StaffId IS NOT NULL ${staffFilter}
    GROUP BY a.StaffId, s.Name, a.ProcessName
    ORDER BY s.Name ASC, TotalRunningSeconds DESC
  `);
  return result.recordset;
}

// --- Agent / computer status -----------------------------------------------------------------------

// 10-minute freshness window - same convention as staffStatus.ts's isPollFresh() elsewhere in
// this app, reused here rather than invented fresh.
const ONLINE_STALE_MINUTES = 10;

export async function getAgentStatusList(): Promise<AgentStatusRow[]> {
  const db = await getDb();
  const result = await db.query<{
    DeviceId: string;
    Hostname: string;
    StaffId: number | null;
    StaffName: string | null;
    AgentVersion: string | null;
    LastHeartbeat: string | null;
    AppActivityIntervalMinutes: number | null;
  }>(`
    SELECT d.DeviceId, d.Hostname, d.StaffId, s.Name AS StaffName, d.AgentVersion, d.LastHeartbeat, d.AppActivityIntervalMinutes
    FROM Devices d LEFT JOIN Staff s ON s.Id = d.StaffId
    WHERE d.DeviceType = 'Workstation'
    ORDER BY d.Hostname ASC
  `);
  const now = Date.now();
  return result.recordset.map((r) => ({
    deviceId: r.DeviceId,
    hostname: r.Hostname,
    staffId: r.StaffId,
    staffName: r.StaffName,
    agentVersion: r.AgentVersion,
    lastHeartbeat: r.LastHeartbeat,
    isOnline: r.LastHeartbeat ? now - new Date(r.LastHeartbeat).getTime() <= ONLINE_STALE_MINUTES * 60 * 1000 : false,
    appActivityEnabled: r.AppActivityIntervalMinutes !== null,
  }));
}
