import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isWebAccessControlSession, requireWebAccessControlPermission } from "@/lib/requireWebAccessControlPermission";
import { getSophosFirewallService } from "@/lib/webAccessControl/sophosFirewallService";
import type { WacCriticalAllowlistEntry } from "@/lib/webAccessControl/types";

interface AllowlistRow {
  Id: number;
  ServiceName: string;
  Domain: string | null;
  IpAddress: string | null;
  Port: number | null;
  MatchType: string;
  IsCritical: boolean;
}

// Symmetric with rules/[id]/sync - see sophosFirewallService.ts for why this is an honest
// stub, never a real Sophos API call.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const wac = await requireWebAccessControlPermission("wac_sophos_sync_manage");
  if (!isWebAccessControlSession(wac)) return wac;

  const { id } = await params;
  const entryId = Number(id);
  const db = await getDb();
  const existing = await db
    .request()
    .input("id", sql.Int, entryId)
    .query<AllowlistRow>("SELECT Id, ServiceName, Domain, IpAddress, Port, MatchType, IsCritical FROM WacCriticalAllowlist WHERE Id = @id");
  const row = existing.recordset[0];
  if (!row) return NextResponse.json({ ok: false, error: "Allowlist entry not found" }, { status: 404 });

  const entry: WacCriticalAllowlistEntry = {
    id: row.Id,
    serviceName: row.ServiceName,
    domain: row.Domain,
    ipAddress: row.IpAddress,
    port: row.Port,
    matchType: row.MatchType as WacCriticalAllowlistEntry["matchType"],
    isCritical: !!row.IsCritical,
  };

  const result = await getSophosFirewallService().syncAllowlistEntry(entry);

  await logAdminAction({
    admin: wac,
    section: "web-access-control",
    action: "allowlist_sync_attempt",
    req,
    details: JSON.stringify({ allowlistId: entryId, serviceName: row.ServiceName, success: result.success, error: result.error ?? null }),
  });

  return NextResponse.json({ ok: true, data: result });
}
