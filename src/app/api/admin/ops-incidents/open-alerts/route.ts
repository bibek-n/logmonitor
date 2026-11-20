import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireOpsIncidentsPermission, isOpsIncidentsSession } from "@/lib/requireOpsIncidentsPermission";

// A lightweight picker for the "create incident from alert(s)" UI - every currently-open
// Security Alert, not just ones no incident has touched yet (an alert can legitimately belong
// to more than one incident over time, e.g. a reopened follow-up).
export async function GET(req: NextRequest) {
  const oi = await requireOpsIncidentsPermission("oi_view");
  if (!isOpsIncidentsSession(oi)) return oi;

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  const db = await getDb();
  const request = db.request();
  let where = "a.Status NOT IN ('Resolved', 'FalsePositive', 'Suppressed')";
  if (q) {
    request.input("q", sql.NVarChar, `%${q}%`);
    where += " AND (a.Category LIKE @q OR a.SourceIp LIKE @q)";
  }

  const result = await request.query<{ Id: number; Category: string; Severity: string; Status: string; SourceIp: string | null; CreatedAt: string }>(`
    SELECT TOP 100 a.Id, a.Category, a.Severity, a.Status, a.SourceIp, CONVERT(VARCHAR(33), a.CreatedAt, 126) AS CreatedAt
    FROM SecurityAlerts a
    WHERE ${where}
    ORDER BY a.CreatedAt DESC
  `);

  return NextResponse.json({ ok: true, data: result.recordset });
}
