import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { isSecurityCenterSession, requireSecurityCenterPermission } from "@/lib/requireSecurityCenterPermission";

// A WAF-branded read-only view over Intrusion Detection's existing SecurityEvents/
// SecurityAlerts/SecurityIpBlocklist - no new table, per the approved plan (WAF Phase 1 adds
// enforcement + rule configuration, not a duplicate event log).
export async function GET(req: NextRequest) {
  const sc = await requireSecurityCenterPermission("sc_view");
  if (!isSecurityCenterSession(sc)) return sc;

  const limitParam = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isInteger(limitParam) && limitParam > 0 && limitParam <= 500 ? limitParam : 100;

  const db = await getDb();

  const alertsResult = await db
    .request()
    .input("limit", sql.Int, limit)
    .query<{
      Id: number;
      Category: string;
      Severity: string;
      SourceIp: string | null;
      RequestPath: string | null;
      ResponseStatus: number | null;
      Status: string;
      CreatedAt: Date;
    }>(
      `SELECT TOP (@limit) Id, Category, Severity, SourceIp, RequestPath, ResponseStatus, Status, CreatedAt
       FROM SecurityAlerts ORDER BY CreatedAt DESC`
    );

  const activeBlocklistResult = await db.query<{ Cnt: number }>("SELECT COUNT(*) AS Cnt FROM SecurityIpBlocklist WHERE IsActive = 1");

  return NextResponse.json({
    ok: true,
    data: {
      events: alertsResult.recordset,
      activeBlocklistCount: activeBlocklistResult.recordset[0]?.Cnt ?? 0,
    },
  });
}
