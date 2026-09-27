import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isWebAccessControlSession, requireWebAccessControlPermission } from "@/lib/requireWebAccessControlPermission";
import { getSophosFirewallService } from "@/lib/webAccessControl/sophosFirewallService";
import type { WacWebsiteRule } from "@/lib/webAccessControl/types";

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

// "Sync to Sophos" button target. Today this always reports back {success:false,
// error:"...not yet configured..."} from StubSophosFirewallService - see
// src/lib/webAccessControl/sophosFirewallService.ts for why this deliberately does not talk
// to a real firewall. The route/UI plumbing is real and ready for when a verified
// implementation exists; only the adapter underneath is a placeholder.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const wac = await requireWebAccessControlPermission("wac_sophos_sync_manage");
  if (!isWebAccessControlSession(wac)) return wac;

  const { id } = await params;
  const ruleId = Number(id);
  const db = await getDb();
  const existing = await db
    .request()
    .input("id", sql.Int, ruleId)
    .query<RuleRow>("SELECT Id, Domain, MatchType, Action, ScopeType, StaffId, WacGroupId, ScheduleId, Priority, Status, CONVERT(VARCHAR(33), UpdatedAt, 126) AS UpdatedAt FROM WacWebsiteRules WHERE Id = @id");
  const row = existing.recordset[0];
  if (!row) return NextResponse.json({ ok: false, error: "Rule not found" }, { status: 404 });

  const rule: WacWebsiteRule = {
    id: row.Id,
    domain: row.Domain,
    matchType: row.MatchType as WacWebsiteRule["matchType"],
    action: row.Action as WacWebsiteRule["action"],
    scopeType: row.ScopeType as WacWebsiteRule["scopeType"],
    staffId: row.StaffId,
    wacGroupId: row.WacGroupId,
    scheduleId: row.ScheduleId,
    priority: row.Priority as WacWebsiteRule["priority"],
    status: row.Status as WacWebsiteRule["status"],
    updatedAt: row.UpdatedAt,
  };

  const result = await getSophosFirewallService().syncRule(rule);

  await logAdminAction({
    admin: wac,
    section: "web-access-control",
    action: "rule_sync_attempt",
    req,
    details: JSON.stringify({ ruleId, domain: row.Domain, success: result.success, error: result.error ?? null }),
  });

  // Honest pass-through - never coerced to a fake 200/success, so the UI can't accidentally
  // render a green "synced" state for a firewall this app never actually reached.
  return NextResponse.json({ ok: true, data: result });
}
