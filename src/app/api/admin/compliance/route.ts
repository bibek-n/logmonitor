import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

// Overview: every framework plus a compliance score derived from its controls' Status
// (not_applicable controls are excluded from the denominator entirely - they don't count for
// or against the score).
export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query<{
    Id: number;
    Key: string;
    Name: string;
    Description: string | null;
    Total: number;
    Implemented: number;
    InProgress: number;
    NotStarted: number;
    NotApplicable: number;
  }>`
    SELECT f.Id, f.[Key], f.Name, f.Description,
      COUNT(c.Id) AS Total,
      SUM(CASE WHEN c.Status = 'implemented' THEN 1 ELSE 0 END) AS Implemented,
      SUM(CASE WHEN c.Status = 'in_progress' THEN 1 ELSE 0 END) AS InProgress,
      SUM(CASE WHEN c.Status = 'not_started' THEN 1 ELSE 0 END) AS NotStarted,
      SUM(CASE WHEN c.Status = 'not_applicable' THEN 1 ELSE 0 END) AS NotApplicable
    FROM ComplianceFrameworks f
    LEFT JOIN ComplianceControls c ON c.FrameworkId = f.Id
    GROUP BY f.Id, f.[Key], f.Name, f.Description
    ORDER BY f.Name ASC
  `;

  const frameworks = result.recordset.map((r) => {
    const applicable = r.Total - r.NotApplicable;
    return {
      id: r.Id,
      key: r.Key,
      name: r.Name,
      description: r.Description,
      totalControls: r.Total,
      implemented: r.Implemented,
      inProgress: r.InProgress,
      notStarted: r.NotStarted,
      notApplicable: r.NotApplicable,
      scorePercent: applicable > 0 ? Math.round((r.Implemented / applicable) * 100) : null,
    };
  });

  return NextResponse.json({ ok: true, data: frameworks });
}
