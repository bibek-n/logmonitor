import { getDb, sql } from "../db";

export interface OffboardingEmployee {
  id: number;
  name: string;
  email: string | null;
  department: string | null;
  employmentStatus: string;
  gitlabUsername: string | null;
  gitlabUserId: number | null;
  glesysMailbox: string | null;
  agentQaUserId: string | null;
  teamworkEmail: string | null;
  logMonitorUsername: string | null;
  adUsername: string | null;
  offboardingDate: string | null;
  latestActionId: number | null;
  gitlabStatus: string | null;
  glesysStatus: string | null;
  agentQaStatus: string | null;
  teamworkStatus: string | null;
  logMonitorStatus: string | null;
  activeDirectoryStatus: string | null;
  overallStatus: string | null;
  lastActionAt: string | null;
}

interface EmployeeRow {
  Id: number;
  Name: string;
  Email: string | null;
  Department: string | null;
  EmploymentStatus: string;
  GitLabUsername: string | null;
  GitLabUserId: number | null;
  GlesysMailbox: string | null;
  AgentQaUserId: string | null;
  TeamworkEmail: string | null;
  LogMonitorUsername: string | null;
  AdUsername: string | null;
  OffboardingDate: Date | null;
  LatestActionId: number | null;
  GitLabStatus: string | null;
  GlesysStatus: string | null;
  AgentQaStatus: string | null;
  TeamworkStatus: string | null;
  LogMonitorStatus: string | null;
  ActiveDirectoryStatus: string | null;
  OverallStatus: string | null;
  LastActionAt: Date | null;
}

function mapEmployee(r: EmployeeRow): OffboardingEmployee {
  return {
    id: r.Id,
    name: r.Name,
    email: r.Email,
    department: r.Department,
    employmentStatus: r.EmploymentStatus,
    gitlabUsername: r.GitLabUsername,
    gitlabUserId: r.GitLabUserId,
    glesysMailbox: r.GlesysMailbox,
    agentQaUserId: r.AgentQaUserId,
    teamworkEmail: r.TeamworkEmail,
    logMonitorUsername: r.LogMonitorUsername,
    adUsername: r.AdUsername,
    offboardingDate: r.OffboardingDate ? r.OffboardingDate.toISOString().slice(0, 10) : null,
    latestActionId: r.LatestActionId,
    gitlabStatus: r.GitLabStatus,
    glesysStatus: r.GlesysStatus,
    agentQaStatus: r.AgentQaStatus,
    teamworkStatus: r.TeamworkStatus,
    logMonitorStatus: r.LogMonitorStatus,
    activeDirectoryStatus: r.ActiveDirectoryStatus,
    overallStatus: r.OverallStatus,
    lastActionAt: r.LastActionAt ? r.LastActionAt.toISOString() : null,
  };
}

const EMPLOYEE_SELECT = `
  SELECT s.Id, s.Name, s.Email, s.Department, s.EmploymentStatus, s.GitLabUsername, s.GitLabUserId,
    s.GlesysMailbox, s.AgentQaUserId, s.TeamworkEmail, s.LogMonitorUsername, s.AdUsername, s.OffboardingDate,
    latest.Id AS LatestActionId, latest.GitLabStatus, latest.GlesysStatus, latest.AgentQaStatus, latest.TeamworkStatus, latest.LogMonitorStatus, latest.ActiveDirectoryStatus, latest.OverallStatus, latest.UpdatedAt AS LastActionAt
  FROM Staff s
  OUTER APPLY (
    SELECT TOP 1 Id, GitLabStatus, GlesysStatus, AgentQaStatus, TeamworkStatus, LogMonitorStatus, ActiveDirectoryStatus, OverallStatus, UpdatedAt
    FROM OffboardingActions oa
    WHERE oa.StaffId = s.Id
    ORDER BY oa.CreatedAt DESC
  ) latest
`;

// One row per employee, left-joined against their single most recent OffboardingActions row (if
// any) via OUTER APPLY - same pattern staffStatus.ts already uses for "most recent X per staff
// member" lookups elsewhere in this app.
export async function listOffboardingEmployees(search?: string): Promise<OffboardingEmployee[]> {
  const db = await getDb();
  const request = db.request();
  let whereClause = "";
  if (search?.trim()) {
    request.input("search", sql.NVarChar, `%${search.trim()}%`);
    whereClause = "WHERE s.Name LIKE @search OR s.Email LIKE @search OR s.GitLabUsername LIKE @search OR s.GlesysMailbox LIKE @search";
  }

  const result = await request.query<EmployeeRow>(`${EMPLOYEE_SELECT} ${whereClause} ORDER BY s.Name ASC`);
  return result.recordset.map(mapEmployee);
}

export async function getOffboardingEmployee(staffId: number): Promise<OffboardingEmployee | null> {
  const db = await getDb();
  const result = await db.request().input("staffId", sql.Int, staffId).query<EmployeeRow>(`${EMPLOYEE_SELECT} WHERE s.Id = @staffId`);
  const row = result.recordset[0];
  return row ? mapEmployee(row) : null;
}

export async function updateEmployeeMapping(
  staffId: number,
  input: {
    gitlabUsername?: string | null;
    gitlabUserId?: number | null;
    glesysMailbox?: string | null;
    agentQaUserId?: string | null;
    teamworkEmail?: string | null;
    logMonitorUsername?: string | null;
    adUsername?: string | null;
    offboardingDate?: string | null;
  }
): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("staffId", sql.Int, staffId)
    .input("gitlabUsername", sql.NVarChar, input.gitlabUsername ?? null)
    .input("gitlabUserId", sql.Int, input.gitlabUserId ?? null)
    .input("glesysMailbox", sql.NVarChar, input.glesysMailbox ?? null)
    .input("agentQaUserId", sql.NVarChar, input.agentQaUserId ?? null)
    .input("teamworkEmail", sql.NVarChar, input.teamworkEmail ?? null)
    .input("logMonitorUsername", sql.NVarChar, input.logMonitorUsername ?? null)
    .input("adUsername", sql.NVarChar, input.adUsername ?? null)
    .input("offboardingDate", sql.Date, input.offboardingDate ?? null)
    .query(
      "UPDATE Staff SET GitLabUsername = @gitlabUsername, GitLabUserId = @gitlabUserId, GlesysMailbox = @glesysMailbox, AgentQaUserId = @agentQaUserId, TeamworkEmail = @teamworkEmail, LogMonitorUsername = @logMonitorUsername, AdUsername = @adUsername, OffboardingDate = @offboardingDate, UpdatedAt = SYSUTCDATETIME() WHERE Id = @staffId"
    );
}

export interface OffboardingActionRow {
  id: number;
  staffId: number;
  gitlabStatus: string;
  gitlabDetail: string | null;
  glesysStatus: string;
  glesysDetail: string | null;
  glesysNewPasswordEncrypted: string | null;
  agentQaStatus: string;
  agentQaDetail: string | null;
  teamworkStatus: string;
  teamworkDetail: string | null;
  teamworkRequestId: string;
  logMonitorStatus: string;
  logMonitorDetail: string | null;
  activeDirectoryStatus: string;
  activeDirectoryDetail: string | null;
  overallStatus: string;
  createdAt: string;
  updatedAt: string;
}

interface ActionRowRaw {
  Id: number;
  StaffId: number;
  GitLabStatus: string;
  GitLabDetail: string | null;
  GlesysStatus: string;
  GlesysDetail: string | null;
  GlesysNewPasswordEncrypted: string | null;
  AgentQaStatus: string;
  AgentQaDetail: string | null;
  TeamworkStatus: string;
  TeamworkDetail: string | null;
  TeamworkRequestId: string;
  LogMonitorStatus: string;
  LogMonitorDetail: string | null;
  ActiveDirectoryStatus: string;
  ActiveDirectoryDetail: string | null;
  OverallStatus: string;
  CreatedAt: Date;
  UpdatedAt: Date;
}

function mapAction(r: ActionRowRaw): OffboardingActionRow {
  return {
    id: r.Id,
    staffId: r.StaffId,
    gitlabStatus: r.GitLabStatus,
    gitlabDetail: r.GitLabDetail,
    glesysStatus: r.GlesysStatus,
    glesysDetail: r.GlesysDetail,
    glesysNewPasswordEncrypted: r.GlesysNewPasswordEncrypted,
    agentQaStatus: r.AgentQaStatus,
    agentQaDetail: r.AgentQaDetail,
    teamworkStatus: r.TeamworkStatus,
    teamworkDetail: r.TeamworkDetail,
    teamworkRequestId: r.TeamworkRequestId,
    logMonitorStatus: r.LogMonitorStatus,
    logMonitorDetail: r.LogMonitorDetail,
    activeDirectoryStatus: r.ActiveDirectoryStatus,
    activeDirectoryDetail: r.ActiveDirectoryDetail,
    overallStatus: r.OverallStatus,
    createdAt: r.CreatedAt.toISOString(),
    updatedAt: r.UpdatedAt.toISOString(),
  };
}

const ACTION_COLUMNS =
  "Id, StaffId, GitLabStatus, GitLabDetail, GlesysStatus, GlesysDetail, GlesysNewPasswordEncrypted, AgentQaStatus, AgentQaDetail, TeamworkStatus, TeamworkDetail, TeamworkRequestId, LogMonitorStatus, LogMonitorDetail, ActiveDirectoryStatus, ActiveDirectoryDetail, OverallStatus, CreatedAt, UpdatedAt";

// "Disable All" is idempotent/retry-safe by reusing the most recent action row for this
// employee as long as it isn't already Complete - a retry after a partial failure updates the
// same row (and its audit trail) rather than spawning a parallel, confusing duplicate.
export async function getOrCreateOpenAction(staffId: number, userId: number, username: string): Promise<OffboardingActionRow> {
  const db = await getDb();
  const existing = await db.request().input("staffId", sql.Int, staffId).query<ActionRowRaw>(
    `SELECT TOP 1 ${ACTION_COLUMNS} FROM OffboardingActions WHERE StaffId = @staffId ORDER BY CreatedAt DESC`
  );
  const row = existing.recordset[0];
  if (row && row.OverallStatus !== "Complete") return mapAction(row);

  const inserted = await db
    .request()
    .input("staffId", sql.Int, staffId)
    .input("userId", sql.Int, userId)
    .input("username", sql.NVarChar, username)
    .query<{ Id: number }>(
      "INSERT INTO OffboardingActions (StaffId, InitiatedByUserId, InitiatedByUsername) OUTPUT INSERTED.Id VALUES (@staffId, @userId, @username)"
    );
  return getActionById(inserted.recordset[0].Id);
}

export async function getActionById(id: number): Promise<OffboardingActionRow> {
  const db = await getDb();
  const result = await db.request().input("id", sql.Int, id).query<ActionRowRaw>(`SELECT ${ACTION_COLUMNS} FROM OffboardingActions WHERE Id = @id`);
  if (!result.recordset[0]) throw new Error(`Offboarding action #${id} not found`);
  return mapAction(result.recordset[0]);
}

export async function listActionsForEmployee(staffId: number): Promise<OffboardingActionRow[]> {
  const db = await getDb();
  const result = await db.request().input("staffId", sql.Int, staffId).query<ActionRowRaw>(
    `SELECT ${ACTION_COLUMNS} FROM OffboardingActions WHERE StaffId = @staffId ORDER BY CreatedAt DESC`
  );
  return result.recordset.map(mapAction);
}

export async function updateActionSystemResult(
  actionId: number,
  system: "gitlab" | "glesys" | "agentqa" | "teamwork" | "logmonitor" | "activedirectory",
  status: string,
  detail: string,
  extra?: { glesysNewPasswordEncrypted?: string }
): Promise<void> {
  const db = await getDb();
  const request = db.request().input("id", sql.Int, actionId).input("status", sql.VarChar, status).input("detail", sql.NVarChar(sql.MAX), detail);
  if (system === "gitlab") {
    await request.query("UPDATE OffboardingActions SET GitLabStatus = @status, GitLabDetail = @detail, GitLabCompletedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");
  } else if (system === "glesys") {
    if (extra?.glesysNewPasswordEncrypted) request.input("pw", sql.NVarChar(sql.MAX), extra.glesysNewPasswordEncrypted);
    await request.query(
      `UPDATE OffboardingActions SET GlesysStatus = @status, GlesysDetail = @detail, GlesysCompletedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()${extra?.glesysNewPasswordEncrypted ? ", GlesysNewPasswordEncrypted = @pw" : ""} WHERE Id = @id`
    );
  } else if (system === "agentqa") {
    await request.query("UPDATE OffboardingActions SET AgentQaStatus = @status, AgentQaDetail = @detail, AgentQaCompletedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");
  } else if (system === "teamwork") {
    await request.query("UPDATE OffboardingActions SET TeamworkStatus = @status, TeamworkDetail = @detail, TeamworkCompletedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");
  } else if (system === "logmonitor") {
    await request.query("UPDATE OffboardingActions SET LogMonitorStatus = @status, LogMonitorDetail = @detail, LogMonitorCompletedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");
  } else {
    await request.query("UPDATE OffboardingActions SET ActiveDirectoryStatus = @status, ActiveDirectoryDetail = @detail, ActiveDirectoryCompletedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");
  }
}

export async function finalizeActionOverallStatus(actionId: number): Promise<OffboardingActionRow> {
  const action = await getActionById(actionId);
  const results = [action.gitlabStatus, action.glesysStatus, action.agentQaStatus, action.teamworkStatus, action.logMonitorStatus, action.activeDirectoryStatus];
  // ManualActionRequired counts as "handled, but a human still has a step to do" - it's not a
  // failure of this system (the password reset itself succeeded), so it doesn't block Complete.
  const succeeded = (s: string) => s === "Success" || s === "Skipped" || s === "ManualActionRequired";
  const overallStatus = results.every(succeeded) ? "Complete" : results.some((s) => s === "Success" || s === "ManualActionRequired") ? "PartiallyComplete" : "Failed";

  const db = await getDb();
  await db.request().input("id", sql.Int, actionId).input("overallStatus", sql.VarChar, overallStatus).query(
    "UPDATE OffboardingActions SET OverallStatus = @overallStatus, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id"
  );
  return { ...action, overallStatus };
}
