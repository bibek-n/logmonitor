import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isWebAccessControlSession, requireWebAccessControlPermission } from "@/lib/requireWebAccessControlPermission";
import { createRuleSchema, updateRuleSchema } from "@/lib/webAccessControl/schema";

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
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const wac = await requireWebAccessControlPermission("wac_view");
  if (!isWebAccessControlSession(wac)) return wac;

  const { id } = await params;
  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, Number(id))
    .query(`
      SELECT r.Id, r.Domain, r.MatchType, r.Action, r.ScopeType, r.StaffId, s.Name AS StaffName,
        r.WacGroupId, g.Name AS WacGroupName, r.ScheduleId, sc.Name AS ScheduleName, r.Priority, r.Status,
        CONVERT(VARCHAR(33), r.CreatedAt, 126) AS CreatedAt, CONVERT(VARCHAR(33), r.UpdatedAt, 126) AS UpdatedAt
      FROM WacWebsiteRules r
      LEFT JOIN Staff s ON s.Id = r.StaffId
      LEFT JOIN WacGroups g ON g.Id = r.WacGroupId
      LEFT JOIN WacSchedules sc ON sc.Id = r.ScheduleId
      WHERE r.Id = @id
    `);
  const row = result.recordset[0];
  if (!row) return NextResponse.json({ ok: false, error: "Rule not found" }, { status: 404 });
  return NextResponse.json({ ok: true, data: row });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const wac = await requireWebAccessControlPermission("wac_rule_edit");
  if (!isWebAccessControlSession(wac)) return wac;

  const { id } = await params;
  const ruleId = Number(id);
  const body = await req.json().catch(() => null);
  const parsedPartial = updateRuleSchema.safeParse(body);
  if (!parsedPartial.success) return NextResponse.json({ ok: false, error: parsedPartial.error.issues[0]?.message ?? "Invalid rule payload" }, { status: 400 });

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, ruleId).query<RuleRow>("SELECT * FROM WacWebsiteRules WHERE Id = @id");
  const before = existing.recordset[0];
  if (!before) return NextResponse.json({ ok: false, error: "Rule not found" }, { status: 404 });

  // Partial update merged onto the existing row, then re-validated as a whole (including the
  // scope/target cross-field check) so e.g. changing scopeType from 'Staff' to 'Group'
  // without also supplying wacGroupId is still rejected.
  const merged = {
    domain: parsedPartial.data.domain ?? before.Domain,
    matchType: parsedPartial.data.matchType ?? (before.MatchType as "exact" | "suffix"),
    action: parsedPartial.data.action ?? (before.Action as "Allow" | "Block"),
    scopeType: parsedPartial.data.scopeType ?? (before.ScopeType as "Staff" | "Group" | "Global"),
    staffId: parsedPartial.data.staffId !== undefined ? parsedPartial.data.staffId : before.StaffId,
    wacGroupId: parsedPartial.data.wacGroupId !== undefined ? parsedPartial.data.wacGroupId : before.WacGroupId,
    scheduleId: parsedPartial.data.scheduleId !== undefined ? parsedPartial.data.scheduleId : before.ScheduleId,
    priority: parsedPartial.data.priority ?? (before.Priority as "Low" | "Normal" | "High"),
    status: parsedPartial.data.status ?? (before.Status as "Enabled" | "Disabled"),
  };
  // Clear the now-irrelevant target when scope changes away from it, so a Staff->Global
  // change doesn't leave a stale StaffId sitting in the row.
  if (merged.scopeType !== "Staff") merged.staffId = null;
  if (merged.scopeType !== "Group") merged.wacGroupId = null;

  const parsed = createRuleSchema.safeParse(merged);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rule payload" }, { status: 400 });
  const r = parsed.data;

  await db
    .request()
    .input("id", sql.Int, ruleId)
    .input("domain", sql.NVarChar, r.domain)
    .input("matchType", sql.VarChar, r.matchType)
    .input("action", sql.VarChar, r.action)
    .input("scopeType", sql.VarChar, r.scopeType)
    .input("staffId", sql.Int, r.staffId ?? null)
    .input("wacGroupId", sql.Int, r.wacGroupId ?? null)
    .input("scheduleId", sql.Int, r.scheduleId ?? null)
    .input("priority", sql.VarChar, r.priority)
    .input("status", sql.VarChar, r.status)
    .input("updatedByUserId", sql.Int, wac.userId)
    .query(`
      UPDATE WacWebsiteRules SET
        Domain = @domain, MatchType = @matchType, Action = @action, ScopeType = @scopeType,
        StaffId = @staffId, WacGroupId = @wacGroupId, ScheduleId = @scheduleId,
        Priority = @priority, Status = @status, UpdatedByUserId = @updatedByUserId, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id
    `);

  await logAdminAction({
    admin: wac,
    section: "web-access-control",
    action: "rule_update",
    req,
    details: JSON.stringify({
      old: { domain: before.Domain, matchType: before.MatchType, action: before.Action, scopeType: before.ScopeType, staffId: before.StaffId, wacGroupId: before.WacGroupId, scheduleId: before.ScheduleId, priority: before.Priority, status: before.Status },
      new: r,
    }),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const wac = await requireWebAccessControlPermission("wac_rule_delete");
  if (!isWebAccessControlSession(wac)) return wac;

  const { id } = await params;
  const ruleId = Number(id);
  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, ruleId).query<RuleRow>("SELECT * FROM WacWebsiteRules WHERE Id = @id");
  const before = existing.recordset[0];
  if (!before) return NextResponse.json({ ok: false, error: "Rule not found" }, { status: 404 });

  await db.request().input("id", sql.Int, ruleId).query("DELETE FROM WacSyncStatus WHERE PolicyType = 'WebsiteRule' AND PolicyId = @id");
  await db.request().input("id", sql.Int, ruleId).query("DELETE FROM WacWebsiteRules WHERE Id = @id");

  await logAdminAction({
    admin: wac,
    section: "web-access-control",
    action: "rule_delete",
    req,
    details: JSON.stringify({ old: { domain: before.Domain, action: before.Action, scopeType: before.ScopeType } }),
  });

  return NextResponse.json({ ok: true });
}
