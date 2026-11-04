import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireWordpressScanPermission, isWordpressScanSession } from "@/lib/requireWordpressScanPermission";

export interface WordPressScanSummary {
  applicationCount: number;
  scansRun: number;
  openCount: number;
  remediatedCount: number;
  exceptionCount: number;
  statusBreakdown: { status: string; count: number }[];
  severityByMonth: { month: string; critical: number; high: number; medium: number; low: number; info: number }[];
}

// Backs the dashboard's stat cards / status donut / risk-rating trend chart. All real,
// persisted data from WordPressFindings (the deduplicated/triaged table — not the raw
// per-scan FindingsJson blob, which would double-count the same issue across repeat scans).
export async function GET() {
  const admin = await requireWordpressScanPermission("wps_view");
  if (!isWordpressScanSession(admin)) return admin;

  const db = await getDb();

  const apps = await db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM Websites WHERE Enabled = 1 AND Platform = 'WordPress'`);
  const scans = await db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM WordPressDeepScans`);

  const statusCounts = await db.query<{ Status: string; n: number }>(`
    SELECT Status, COUNT(*) AS n FROM WordPressFindings GROUP BY Status
  `);
  const byStatus = new Map(statusCounts.recordset.map((r) => [r.Status, r.n]));
  const open = (byStatus.get("Open") ?? 0) + (byStatus.get("InProgress") ?? 0);
  const resolved = byStatus.get("Resolved") ?? 0;
  const acceptedRisk = byStatus.get("AcceptedRisk") ?? 0;
  const falsePositive = byStatus.get("FalsePositive") ?? 0;

  // Last 12 months, by the month a finding was FIRST seen — a finding that's still open
  // continues to count in the month it was discovered, not every month it remains unresolved.
  const trend = await db.query<{ MonthKey: string; Severity: string; n: number }>(`
    SELECT FORMAT(FirstSeenAt, 'yyyy-MM') AS MonthKey, Severity, COUNT(*) AS n
    FROM WordPressFindings
    WHERE FirstSeenAt >= DATEADD(MONTH, -11, DATEADD(DAY, 1 - DAY(SYSUTCDATETIME()), CAST(SYSUTCDATETIME() AS DATE)))
    GROUP BY FORMAT(FirstSeenAt, 'yyyy-MM'), Severity
  `);

  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  const severityByMonth = months.map((monthKey) => {
    const rowsForMonth = trend.recordset.filter((r) => r.MonthKey === monthKey);
    const pick = (sev: string) => rowsForMonth.find((r) => r.Severity === sev)?.n ?? 0;
    return {
      month: monthKey,
      critical: pick("critical"),
      high: pick("high"),
      medium: pick("medium"),
      low: pick("low"),
      info: pick("info"),
    };
  });

  const summary: WordPressScanSummary = {
    applicationCount: apps.recordset[0].n,
    scansRun: scans.recordset[0].n,
    openCount: open,
    remediatedCount: resolved,
    exceptionCount: acceptedRisk,
    statusBreakdown: [
      { status: "Open", count: open },
      { status: "Resolved", count: resolved },
      { status: "AcceptedRisk", count: acceptedRisk },
      { status: "FalsePositive", count: falsePositive },
    ],
    severityByMonth,
  };

  return NextResponse.json({ ok: true, data: summary });
}
