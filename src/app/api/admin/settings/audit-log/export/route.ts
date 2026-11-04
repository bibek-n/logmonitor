import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { rowsToCsv } from "@/lib/csv";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const section = req.nextUrl.searchParams.get("section");
  const request = (await getDb()).request();
  let query = `
    SELECT Username, Section, Action, Details, IpAddress, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
    FROM AdminAuditLog
  `;
  if (section) {
    query += " WHERE Section = @section";
    request.input("section", sql.NVarChar, section);
  }
  query += " ORDER BY CreatedAt DESC";
  const result = await request.query<{
    Username: string;
    Section: string;
    Action: string;
    Details: string | null;
    IpAddress: string | null;
    CreatedAt: string;
  }>(query);

  const csv = rowsToCsv(
    ["User", "Section", "Action", "Details", "IP", "When (UTC)"],
    result.recordset.map((r) => [r.Username, r.Section, r.Action, r.Details ?? "", r.IpAddress ?? "", r.CreatedAt.replace("T", " ")])
  );

  await logAdminAction({ admin, section: "settings", action: "export_audit_log", details: `${result.recordset.length} rows${section ? ` (section=${section})` : ""}`, req });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
