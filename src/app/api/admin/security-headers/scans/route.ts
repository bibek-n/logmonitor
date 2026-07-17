import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;

interface ScanListRow {
  Id: number;
  WebsiteId: number | null;
  TargetUrl: string;
  IpAddress: string | null;
  Grade: string;
  Score: number;
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

  const countResult = await db.request().query<{ total: number }>("SELECT COUNT(*) AS total FROM SecurityHeaderScans");
  const total = countResult.recordset[0].total;

  const rowsResult = await db.request().input("offset", sql.Int, offset).input("pageSize", sql.Int, pageSize).query<ScanListRow>(`
    SELECT Id, WebsiteId, TargetUrl, IpAddress, Grade, Score, TriggeredByUsername,
      CONVERT(VARCHAR(19), ScannedAt, 126) AS ScannedAt
    FROM SecurityHeaderScans
    ORDER BY ScannedAt DESC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);

  return NextResponse.json({
    ok: true,
    data: rowsResult.recordset,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}
