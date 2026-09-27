import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isWebAccessControlSession, requireWebAccessControlPermission } from "@/lib/requireWebAccessControlPermission";
import { createRuleSchema } from "@/lib/webAccessControl/schema";

export async function GET(req: NextRequest) {
  const wac = await requireWebAccessControlPermission("wac_view");
  if (!isWebAccessControlSession(wac)) return wac;

  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain");
  const scopeType = searchParams.get("scopeType");
  const status = searchParams.get("status");
  const wacGroupId = searchParams.get("wacGroupId");
  const staffId = searchParams.get("staffId");

  const request = (await getDb()).request();
  const conditions: string[] = [];
  if (domain) {
    conditions.push("r.Domain LIKE @domain");
    request.input("domain", sql.NVarChar, `%${domain}%`);
  }
  if (scopeType) {
    conditions.push("r.ScopeType = @scopeType");
    request.input("scopeType", sql.VarChar, scopeType);
  }
  if (status) {
    conditions.push("r.Status = @status");
    request.input("status", sql.VarChar, status);
  }
  if (wacGroupId) {
    conditions.push("r.WacGroupId = @wacGroupId");
    request.input("wacGroupId", sql.Int, Number(wacGroupId));
  }
  if (staffId) {
    conditions.push("r.StaffId = @staffId");
    request.input("staffId", sql.Int, Number(staffId));
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // sd.WebsiteBlockingEnabled lets the UI flag a Staff-scoped rule that will never actually
  // enforce anything because local blocking hasn't been turned on for that employee's device
  // yet (see the matching comment in web-access-control/staff/route.ts) - an easy way for a
  // per-employee Block rule to look configured but silently do nothing.
  const result = await request.query(`
    SELECT r.Id, r.Domain, r.MatchType, r.Action, r.ScopeType, r.StaffId, s.Name AS StaffName,
      sd.WebsiteBlockingEnabled AS StaffWebsiteBlockingEnabled,
      r.WacGroupId, g.Name AS WacGroupName, r.ScheduleId, sc.Name AS ScheduleName,
      r.Priority, r.Status, CONVERT(VARCHAR(33), r.CreatedAt, 126) AS CreatedAt, CONVERT(VARCHAR(33), r.UpdatedAt, 126) AS UpdatedAt,
      sy.Status AS SophosSyncStatus
    FROM WacWebsiteRules r
    LEFT JOIN Staff s ON s.Id = r.StaffId
    LEFT JOIN Devices sd ON sd.StaffId = r.StaffId
    LEFT JOIN WacGroups g ON g.Id = r.WacGroupId
    LEFT JOIN WacSchedules sc ON sc.Id = r.ScheduleId
    LEFT JOIN WacSyncStatus sy ON sy.PolicyType = 'WebsiteRule' AND sy.PolicyId = r.Id
    ${where}
    ORDER BY r.UpdatedAt DESC
  `);

  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest) {
  const wac = await requireWebAccessControlPermission("wac_rule_create");
  if (!isWebAccessControlSession(wac)) return wac;

  const body = await req.json().catch(() => null);
  const parsed = createRuleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rule payload" }, { status: 400 });
  const r = parsed.data;

  const db = await getDb();

  if (r.scopeType === "Staff" && r.staffId) {
    const staffExists = await db.request().input("id", sql.Int, r.staffId).query<{ Cnt: number }>("SELECT COUNT(*) AS Cnt FROM Staff WHERE Id = @id");
    if (staffExists.recordset[0].Cnt === 0) return NextResponse.json({ ok: false, error: "Staff member not found" }, { status: 400 });
  }
  if (r.scopeType === "Group" && r.wacGroupId) {
    const groupExists = await db.request().input("id", sql.Int, r.wacGroupId).query<{ Cnt: number }>("SELECT COUNT(*) AS Cnt FROM WacGroups WHERE Id = @id");
    if (groupExists.recordset[0].Cnt === 0) return NextResponse.json({ ok: false, error: "Staff group not found" }, { status: 400 });
  }
  if (r.scheduleId) {
    const scheduleExists = await db.request().input("id", sql.Int, r.scheduleId).query<{ Cnt: number }>("SELECT COUNT(*) AS Cnt FROM WacSchedules WHERE Id = @id");
    if (scheduleExists.recordset[0].Cnt === 0) return NextResponse.json({ ok: false, error: "Schedule not found" }, { status: 400 });
  }

  const inserted = await db
    .request()
    .input("domain", sql.NVarChar, r.domain)
    .input("matchType", sql.VarChar, r.matchType)
    .input("action", sql.VarChar, r.action)
    .input("scopeType", sql.VarChar, r.scopeType)
    .input("staffId", sql.Int, r.staffId ?? null)
    .input("wacGroupId", sql.Int, r.wacGroupId ?? null)
    .input("scheduleId", sql.Int, r.scheduleId ?? null)
    .input("priority", sql.VarChar, r.priority)
    .input("status", sql.VarChar, r.status)
    .input("createdByUserId", sql.Int, wac.userId)
    .query<{ Id: number }>(`
      INSERT INTO WacWebsiteRules
        (Domain, MatchType, Action, ScopeType, StaffId, WacGroupId, ScheduleId, Priority, Status, CreatedByUserId, UpdatedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@domain, @matchType, @action, @scopeType, @staffId, @wacGroupId, @scheduleId, @priority, @status, @createdByUserId, @createdByUserId)
    `);

  await logAdminAction({
    admin: wac,
    section: "web-access-control",
    action: "rule_create",
    req,
    details: JSON.stringify({ new: r }),
  });

  return NextResponse.json({ ok: true, data: { id: inserted.recordset[0].Id } });
}
