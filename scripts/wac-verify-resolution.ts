import "dotenv/config";
import { getDb, sql } from "../src/lib/db";
import { resolveAccess } from "../src/lib/webAccessControl/rulesEngine";
import type { WacWebsiteRule, WacCriticalAllowlistEntry, WacSchedule } from "../src/lib/webAccessControl/types";

// Read-only: runs the REAL rulesEngine against the current DB rows to show what a request for <domain>
// from <staffId> resolves to right now. Usage: tsx scripts/wac-verify-resolution.ts <staffId> <domain>
async function main() {
  const staffId = Number(process.argv[2]);
  const domain = process.argv[3];
  if (!Number.isInteger(staffId) || !domain) {
    console.error("usage: wac-verify-resolution.ts <staffId> <domain>");
    process.exit(2);
  }
  const db = await getDb();
  const staff = await db.request().input("id", sql.Int, staffId).query<{ WacGroupId: number | null }>("SELECT WacGroupId FROM Staff WHERE Id = @id");
  if (!staff.recordset[0]) {
    console.error("staff not found");
    process.exit(1);
  }
  const rulesRaw = await db.query(`SELECT Id, Domain, MatchType, Action, ScopeType, StaffId, WacGroupId, ScheduleId, Priority, Status, CONVERT(VARCHAR(33), UpdatedAt, 126) AS UpdatedAt FROM WacWebsiteRules`);
  const allowlistRaw = await db.query(`SELECT Id, ServiceName, Domain, IpAddress, Port, MatchType, IsCritical FROM WacCriticalAllowlist`);
  const schedulesRaw = await db.query(`SELECT Id, Name, DaysOfWeek, StartTime, EndTime, IsBuiltIn FROM WacSchedules`);

  const rules: WacWebsiteRule[] = rulesRaw.recordset.map((r) => ({
    id: r.Id, domain: r.Domain, matchType: r.MatchType, action: r.Action, scopeType: r.ScopeType,
    staffId: r.StaffId, wacGroupId: r.WacGroupId, scheduleId: r.ScheduleId, priority: r.Priority, status: r.Status, updatedAt: r.UpdatedAt,
  }));
  const allowlist: WacCriticalAllowlistEntry[] = allowlistRaw.recordset.map((r) => ({ id: r.Id, serviceName: r.ServiceName, domain: r.Domain, ipAddress: r.IpAddress, port: r.Port, matchType: r.MatchType, isCritical: r.IsCritical }));
  const schedules: WacSchedule[] = schedulesRaw.recordset.map((r) => ({ id: r.Id, name: r.Name, daysOfWeek: r.DaysOfWeek, startTime: r.StartTime, endTime: r.EndTime, isBuiltIn: r.IsBuiltIn }));

  const result = resolveAccess({ domain, staffId, staffGroupId: staff.recordset[0].WacGroupId, rules, allowlist, schedules });
  console.log(JSON.stringify(result, null, 1));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
