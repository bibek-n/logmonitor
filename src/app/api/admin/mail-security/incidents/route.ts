import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { isMailSession, requireMailPolicyPermission } from "@/lib/requireMailPolicyPermission";

const PAGE_SIZE = 50;

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\r\n");
}

export async function GET(req: NextRequest) {
  const mail = await requireMailPolicyPermission("mail_view_incidents");
  if (!isMailSession(mail)) return mail;

  const searchParams = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const direction = searchParams.get("direction");
  const action = searchParams.get("action");
  const format = searchParams.get("format");

  const conditions: string[] = [];
  const request = (await getDb()).request();
  if (direction && ["Incoming", "Outgoing"].includes(direction)) {
    conditions.push("Direction = @direction");
    request.input("direction", sql.VarChar, direction);
  }
  if (action) {
    conditions.push("ActionTaken = @action");
    request.input("action", sql.VarChar, action);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  if (format === "csv") {
    const result = await request.query(`
      SELECT i.IncidentId, i.Source, i.Direction, i.Sender, i.Recipients, i.Subject, p.Name AS PolicyName,
        i.ActionTaken, i.BlockReason, i.NotificationStatus, CONVERT(VARCHAR(19), i.DetectedAt, 126) AS DetectedAt
      FROM MailSecurityIncidents i
      LEFT JOIN MailBlockingPolicies p ON p.Id = i.MatchedPolicyId
      ${where}
      ORDER BY i.DetectedAt DESC
    `);
    return new NextResponse(toCsv(result.recordset), {
      headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=mail-security-incidents.csv" },
    });
  }

  const countResult = await request.query<{ Total: number }>(`SELECT COUNT(*) AS Total FROM MailSecurityIncidents ${where}`);
  const total = countResult.recordset[0].Total;

  const pagedRequest = (await getDb()).request();
  if (direction && ["Incoming", "Outgoing"].includes(direction)) pagedRequest.input("direction", sql.VarChar, direction);
  if (action) pagedRequest.input("action", sql.VarChar, action);
  pagedRequest.input("offset", sql.Int, (page - 1) * PAGE_SIZE).input("limit", sql.Int, PAGE_SIZE);

  const result = await pagedRequest.query(`
    SELECT i.Id, i.IncidentId, i.Source, i.Direction, i.Sender, i.Recipients, i.Subject, p.Name AS PolicyName,
      i.ActionTaken, i.BlockReason, i.NotificationStatus, i.ProcessingTimeMs, CONVERT(VARCHAR(19), i.DetectedAt, 126) AS DetectedAt
    FROM MailSecurityIncidents i
    LEFT JOIN MailBlockingPolicies p ON p.Id = i.MatchedPolicyId
    ${where}
    ORDER BY i.DetectedAt DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  return NextResponse.json({ ok: true, data: result.recordset, total, page, pageSize: PAGE_SIZE });
}
