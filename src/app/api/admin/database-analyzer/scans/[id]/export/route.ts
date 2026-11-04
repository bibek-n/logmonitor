import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireDbAnalyzerPermission, isDbAnalyzerSession } from "@/lib/requireDbAnalyzerPermission";

function csvEscape(value: unknown): string {
  const str = value == null ? "" : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireDbAnalyzerPermission("dba_export");
  if (!isDbAnalyzerSession(admin)) return admin;

  const { id } = await params;
  const scanId = Number(id);
  const format = req.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";
  if (!Number.isInteger(scanId)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const db = await getDb();
  const findingsResult = await db
    .request()
    .input("id", sql.Int, scanId)
    .query<{
      Category: string;
      Severity: string;
      Title: string;
      Detail: string | null;
      Evidence: string | null;
      AffectedObject: string | null;
      Recommendation: string | null;
      Source: string | null;
    }>(
      "SELECT Category, Severity, Title, Detail, Evidence, AffectedObject, Recommendation, Source FROM DbAnalyzerFindings WHERE ScanId = @id ORDER BY CASE Severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END"
    );
  const rows = findingsResult.recordset;

  if (format === "json") {
    return new NextResponse(JSON.stringify({ scanId, findings: rows }, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="db-analyzer-scan-${scanId}.json"`,
      },
    });
  }

  const header = ["Category", "Severity", "Title", "Detail", "Evidence", "AffectedObject", "Recommendation", "Source"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([r.Category, r.Severity, r.Title, r.Detail, r.Evidence, r.AffectedObject, r.Recommendation, r.Source].map(csvEscape).join(","));
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="db-analyzer-scan-${scanId}.csv"`,
    },
  });
}
