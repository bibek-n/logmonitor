import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { isBrowserActivitySession, requireBrowserActivityPermission } from "@/lib/requireBrowserActivityPermission";

// Read-only view of this module's slice of AdminAuditLog (Section = 'browser-activity') -
// the "who viewed/searched/exported/modified/deleted monitoring data" trail required by the
// approved plan. No new audit table exists; every route in this module writes here via
// logAdminAction() instead.
export async function GET(req: NextRequest) {
  const ba = await requireBrowserActivityPermission("ba_audit_log_view");
  if (!isBrowserActivitySession(ba)) return ba;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get("pageSize") ?? 50)));
  const offset = (page - 1) * pageSize;

  const db = await getDb();
  const req2 = db.request().input("offset", sql.Int, offset).input("pageSize", sql.Int, pageSize);

  const [rows, count] = await Promise.all([
    req2.query(`
      SELECT * FROM AdminAuditLog WHERE Section = 'browser-activity'
      ORDER BY CreatedAt DESC OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `),
    db.query`SELECT COUNT(*) AS Total FROM AdminAuditLog WHERE Section = 'browser-activity'`,
  ]);

  return NextResponse.json({ ok: true, data: { entries: rows.recordset, total: count.recordset[0].Total } });
}
