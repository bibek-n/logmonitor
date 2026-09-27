import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isWebAccessControlSession, requireWebAccessControlPermission } from "@/lib/requireWebAccessControlPermission";

export async function GET() {
  const wac = await requireWebAccessControlPermission("wac_view");
  if (!isWebAccessControlSession(wac)) return wac;

  const db = await getDb();

  const [staffCount, ruleCounts, groupCount, allowlistCount, recentChanges, syncStatus] = await Promise.all([
    db.query<{ Cnt: number }>("SELECT COUNT(*) AS Cnt FROM Staff"),
    db.query<{ Action: string; Cnt: number }>("SELECT Action, COUNT(*) AS Cnt FROM WacWebsiteRules WHERE Status = 'Enabled' GROUP BY Action"),
    db.query<{ Cnt: number }>("SELECT COUNT(*) AS Cnt FROM WacGroups"),
    db.query<{ Cnt: number }>("SELECT COUNT(*) AS Cnt FROM WacCriticalAllowlist"),
    db.query(`
      SELECT TOP 10 Id, Username, Action, Details, CONVERT(VARCHAR(33), CreatedAt, 126) AS CreatedAt
      FROM AdminAuditLog WHERE Section = 'web-access-control' ORDER BY Id DESC
    `),
    // Honest summary of a module that has no live Sophos connection yet - see
    // sophosFirewallService.ts. This mostly reads "no rows yet" (nothing has been synced) or
    // "NotConnected" (a sync was attempted and failed), never a fabricated "Synced" count.
    db.query<{ Status: string; Cnt: number }>("SELECT Status, COUNT(*) AS Cnt FROM WacSyncStatus GROUP BY Status"),
  ]);

  const allowedWebsites = ruleCounts.recordset.find((r) => r.Action === "Allow")?.Cnt ?? 0;
  const blockedWebsites = ruleCounts.recordset.find((r) => r.Action === "Block")?.Cnt ?? 0;

  return NextResponse.json({
    ok: true,
    data: {
      totalStaff: staffCount.recordset[0]?.Cnt ?? 0,
      allowedWebsites,
      blockedWebsites,
      staffGroups: groupCount.recordset[0]?.Cnt ?? 0,
      criticalApplications: allowlistCount.recordset[0]?.Cnt ?? 0,
      recentPolicyChanges: recentChanges.recordset,
      sophosSyncStatus: syncStatus.recordset,
    },
  });
}
