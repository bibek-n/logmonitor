import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import type { ThreatScanRow } from "@/lib/threatScanner/shared";

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;
const VALID_KINDS = new Set(["File", "Url", "Hash", "Ip", "Domain"]);

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(sp.get("pageSize")) || PAGE_SIZE_DEFAULT));
  const offset = (page - 1) * pageSize;
  const kindFilter = sp.get("kind");
  const kindClause = kindFilter && VALID_KINDS.has(kindFilter) ? "WHERE Kind = @kind" : "";

  const db = await getDb();
  const request = db.request();
  if (kindClause) request.input("kind", sql.VarChar, kindFilter);

  const countResult = await request.query<{ total: number }>(`SELECT COUNT(*) AS total FROM ThreatScans ${kindClause}`);
  const total = countResult.recordset[0].total;

  const rowsRequest = db.request();
  if (kindClause) rowsRequest.input("kind", sql.VarChar, kindFilter);
  const rowsResult = await rowsRequest.input("offset", sql.Int, offset).input("pageSize", sql.Int, pageSize).query<ThreatScanRow>(`
    SELECT Id, Kind, Target, WebsiteId, Status, Verdict, MaliciousCount, SuspiciousCount, HarmlessCount,
      UndetectedCount, TimeoutCount, EngineCount, OriginalFileName, ContentType, SizeBytes, TriggeredByUsername,
      CONVERT(VARCHAR(19), StartedAt, 126) AS StartedAt, CONVERT(VARCHAR(19), CompletedAt, 126) AS CompletedAt,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
    FROM ThreatScans
    ${kindClause}
    ORDER BY CreatedAt DESC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);

  return NextResponse.json({
    ok: true,
    data: rowsResult.recordset,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}
