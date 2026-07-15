import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { VALID_SCAN_DEVICES, type WebsitePerformanceScanRow } from "@/lib/websitePerformance/shared";

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;

export async function GET(req: NextRequest, { params }: { params: Promise<{ websiteId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const websiteId = Number((await params).websiteId);
  if (!Number.isInteger(websiteId)) return NextResponse.json({ ok: false, error: "Invalid websiteId." }, { status: 400 });

  const sp = req.nextUrl.searchParams;
  const device = sp.get("device");
  if (device && !VALID_SCAN_DEVICES.has(device)) return NextResponse.json({ ok: false, error: "Invalid device filter." }, { status: 400 });

  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(sp.get("pageSize")) || PAGE_SIZE_DEFAULT));
  const offset = (page - 1) * pageSize;

  const db = await getDb();
  const where = device ? "WHERE WebsiteId = @websiteId AND Device = @device" : "WHERE WebsiteId = @websiteId";

  const countRequest = db.request().input("websiteId", sql.Int, websiteId);
  if (device) countRequest.input("device", sql.VarChar, device);
  const countResult = await countRequest.query<{ Total: number }>(`SELECT COUNT(*) AS Total FROM WebsitePerformanceScans ${where}`);
  const total = countResult.recordset[0]?.Total ?? 0;

  const rowsRequest = db.request().input("websiteId", sql.Int, websiteId).input("offset", sql.Int, offset).input("pageSize", sql.Int, pageSize);
  if (device) rowsRequest.input("device", sql.VarChar, device);
  const rowsResult = await rowsRequest.query<WebsitePerformanceScanRow>(`
    SELECT * FROM WebsitePerformanceScans ${where}
    ORDER BY CreatedAt DESC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);

  return NextResponse.json({
    ok: true,
    data: rowsResult.recordset,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}
