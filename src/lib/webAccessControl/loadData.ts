import { getDb, sql } from "../db";
import type { WacCriticalAllowlistEntry, WacSchedule, WacWebsiteRule } from "./types";

// Shared DB -> rulesEngine input mapping, used by both the /rules/preview route and the
// dashboard summary counts - kept in one place so the camelCase shape rulesEngine.ts expects
// is only ever assembled once, not re-derived slightly differently in every call site.

interface RuleRow {
  Id: number;
  Domain: string;
  MatchType: string;
  Action: string;
  ScopeType: string;
  StaffId: number | null;
  WacGroupId: number | null;
  ScheduleId: number | null;
  Priority: string;
  Status: string;
  UpdatedAt: string;
}

interface AllowlistRow {
  Id: number;
  ServiceName: string;
  Domain: string | null;
  IpAddress: string | null;
  Port: number | null;
  MatchType: string;
  IsCritical: boolean;
}

interface ScheduleRow {
  Id: number;
  Name: string;
  DaysOfWeek: string | null;
  StartTime: string | null;
  EndTime: string | null;
  IsBuiltIn: boolean;
}

export async function loadRulesEngineData(): Promise<{
  rules: WacWebsiteRule[];
  allowlist: WacCriticalAllowlistEntry[];
  schedules: WacSchedule[];
}> {
  const db = await getDb();

  const rulesResult = await db.query<RuleRow>(`
    SELECT Id, Domain, MatchType, Action, ScopeType, StaffId, WacGroupId, ScheduleId, Priority, Status,
      CONVERT(VARCHAR(33), UpdatedAt, 126) AS UpdatedAt
    FROM WacWebsiteRules
  `);
  const allowlistResult = await db.query<AllowlistRow>(`
    SELECT Id, ServiceName, Domain, IpAddress, Port, MatchType, IsCritical FROM WacCriticalAllowlist
  `);
  const schedulesResult = await db.query<ScheduleRow>(`
    SELECT Id, Name, DaysOfWeek, CONVERT(VARCHAR(8), StartTime, 108) AS StartTime, CONVERT(VARCHAR(8), EndTime, 108) AS EndTime, IsBuiltIn
    FROM WacSchedules
  `);

  const rules: WacWebsiteRule[] = rulesResult.recordset.map((r) => ({
    id: r.Id,
    domain: r.Domain,
    matchType: r.MatchType as WacWebsiteRule["matchType"],
    action: r.Action as WacWebsiteRule["action"],
    scopeType: r.ScopeType as WacWebsiteRule["scopeType"],
    staffId: r.StaffId,
    wacGroupId: r.WacGroupId,
    scheduleId: r.ScheduleId,
    priority: r.Priority as WacWebsiteRule["priority"],
    status: r.Status as WacWebsiteRule["status"],
    updatedAt: r.UpdatedAt,
  }));

  const allowlist: WacCriticalAllowlistEntry[] = allowlistResult.recordset.map((a) => ({
    id: a.Id,
    serviceName: a.ServiceName,
    domain: a.Domain,
    ipAddress: a.IpAddress,
    port: a.Port,
    matchType: a.MatchType as WacCriticalAllowlistEntry["matchType"],
    isCritical: !!a.IsCritical,
  }));

  const schedules: WacSchedule[] = schedulesResult.recordset.map((s) => ({
    id: s.Id,
    name: s.Name,
    daysOfWeek: s.DaysOfWeek,
    startTime: s.StartTime ? s.StartTime.slice(0, 5) : null,
    endTime: s.EndTime ? s.EndTime.slice(0, 5) : null,
    isBuiltIn: !!s.IsBuiltIn,
  }));

  return { rules, allowlist, schedules };
}

export async function getStaffGroupId(staffId: number): Promise<number | null> {
  const db = await getDb();
  const result = await db
    .request()
    .input("staffId", sql.Int, staffId)
    .query<{ WacGroupId: number | null }>("SELECT WacGroupId FROM Staff WHERE Id = @staffId");
  return result.recordset[0]?.WacGroupId ?? null;
}
