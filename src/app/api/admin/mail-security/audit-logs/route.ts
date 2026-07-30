import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { isMailSession, requireMailPolicyPermission } from "@/lib/requireMailPolicyPermission";

const PAGE_SIZE = 50;

// Thin passthrough over the existing shared AdminAuditLog table (filtered to this module's
// section) rather than a parallel mail_policy_audit_logs table - every other admin route in
// this app already writes here via logAdminAction(), so this is the single source of truth
// for "who changed a mail-security policy/exception/template/connector and when."
export async function GET(req: NextRequest) {
  const mail = await requireMailPolicyPermission("mail_view");
  if (!isMailSession(mail)) return mail;

  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const db = await getDb();

  const countResult = await db.query<{ Total: number }>("SELECT COUNT(*) AS Total FROM AdminAuditLog WHERE Section = 'mail-security'");
  const result = await db
    .request()
    .input("offset", sql.Int, (page - 1) * PAGE_SIZE)
    .input("limit", sql.Int, PAGE_SIZE)
    .query(`
      SELECT Id, Username, Action, Details, IpAddress, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
      FROM AdminAuditLog
      WHERE Section = 'mail-security'
      ORDER BY CreatedAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

  return NextResponse.json({ ok: true, data: result.recordset, total: countResult.recordset[0].Total, page, pageSize: PAGE_SIZE });
}
