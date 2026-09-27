import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { isWebAccessControlSession, requireWebAccessControlPermission } from "@/lib/requireWebAccessControlPermission";

const PAGE_SIZE = 25;

export async function GET(req: NextRequest) {
  const wac = await requireWebAccessControlPermission("wac_audit_log_view");
  if (!isWebAccessControlSession(wac)) return wac;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const db = await getDb();
  const [rows, total] = await Promise.all([
    db
      .request()
      .input("offset", sql.Int, offset)
      .input("pageSize", sql.Int, PAGE_SIZE)
      .query(`
        SELECT Id, UserId, Username, Action, Details, IpAddress, CONVERT(VARCHAR(33), CreatedAt, 126) AS CreatedAt
        FROM AdminAuditLog
        WHERE Section = 'web-access-control'
        ORDER BY Id DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `),
    db.query<{ Cnt: number }>("SELECT COUNT(*) AS Cnt FROM AdminAuditLog WHERE Section = 'web-access-control'"),
  ]);

  return NextResponse.json({
    ok: true,
    data: rows.recordset,
    pagination: { page, pageSize: PAGE_SIZE, total: total.recordset[0]?.Cnt ?? 0 },
  });
}
