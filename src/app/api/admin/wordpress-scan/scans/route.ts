import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;

interface ScanListRow {
  Id: number;
  WebsiteId: number | null;
  TargetUrl: string;
  IsWordPress: boolean;
  CoreVersion: string | null;
  RiskLevel: string;
  TriggeredByUsername: string | null;
  ScannedAt: string;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(sp.get("pageSize")) || PAGE_SIZE_DEFAULT));
  const offset = (page - 1) * pageSize;

  const db = await getDb();
  const countResult = await db.request().query<{ total: number }>("SELECT COUNT(*) AS total FROM WordPressDeepScans");
  const total = countResult.recordset[0].total;

  const rowsResult = await db.request().input("offset", sql.Int, offset).input("pageSize", sql.Int, pageSize).query<ScanListRow>(`
    SELECT Id, WebsiteId, TargetUrl, IsWordPress, CoreVersion, RiskLevel, TriggeredByUsername,
      CONVERT(VARCHAR(19), ScannedAt, 126) AS ScannedAt
    FROM WordPressDeepScans
    ORDER BY ScannedAt DESC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);

  return NextResponse.json({
    ok: true,
    data: rowsResult.recordset,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}
