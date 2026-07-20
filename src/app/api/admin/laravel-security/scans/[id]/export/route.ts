import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireLaravelSecurityPermission, isLsSession } from "@/lib/requireLaravelSecurityPermission";
import { logAdminAction } from "@/lib/adminAudit";

interface ExportIssueRow {
  IssueNumber: string | null;
  Category: string;
  RuleCode: string | null;
  Title: string;
  FilePath: string;
  StartLine: number | null;
  EndLine: number | null;
  Severity: string;
  Status: string;
  ConfidenceLevel: string | null;
  Recommendation: string | null;
}

function toCsv(rows: ExportIssueRow[]): string {
  const headers = ["IssueNumber", "Category", "RuleCode", "Title", "FilePath", "StartLine", "EndLine", "Severity", "Status", "ConfidenceLevel", "Recommendation"];
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h as keyof ExportIssueRow])).join(","));
  }
  return lines.join("\r\n");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ls = await requireLaravelSecurityPermission("ls_export");
  if (!isLsSession(ls)) return ls;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid scan id" }, { status: 400 });

  const format = req.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";

  const db = await getDb();
  const scan = await db.request().input("id", sql.Int, id).query<{ Id: number; ProjectId: number }>("SELECT Id, ProjectId FROM LaravelSecurityScans WHERE Id = @id");
  if (!scan.recordset[0]) return NextResponse.json({ ok: false, error: "Scan not found" }, { status: 404 });

  const issues = await db.request().input("id", sql.Int, id).query<ExportIssueRow>(`
    SELECT IssueNumber, Category, RuleCode, Title, FilePath, StartLine, EndLine, Severity, Status, ConfidenceLevel, Recommendation
    FROM LaravelSecurityIssues WHERE ScanId = @id
    ORDER BY Severity DESC, Category, FilePath
  `);

  await logAdminAction({ admin: ls, section: "laravel-security", action: "export_scan", details: `Scan #${id} (${format})`, req });

  if (format === "csv") {
    return new NextResponse(toCsv(issues.recordset), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="laravel-security-scan-${id}.csv"` },
    });
  }

  return NextResponse.json({ ok: true, data: issues.recordset });
}
