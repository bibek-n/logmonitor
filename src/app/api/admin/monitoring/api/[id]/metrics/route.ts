import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";

// Identical query shape to the website monitor's /metrics route - MonitorResults is shared
// across both monitor types and this query has never depended on MonitorType.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_view");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const days = Math.min(90, Math.max(1, parseInt(req.nextUrl.searchParams.get("days") ?? "7", 10) || 7));
  const db = await getDb();

  const result = await db
    .request()
    .input("id", sql.Int, Number(id))
    .input("days", sql.Int, days)
    .query<{
      TotalChecks: number;
      SuccessfulChecks: number;
      Current: number | null;
      Avg: number | null;
      Min: number | null;
      Max: number | null;
      P50: number | null;
      P90: number | null;
      P95: number | null;
      P99: number | null;
    }>(`
      WITH Recent AS (
        SELECT TotalMs, Success, CheckedAt FROM MonitorResults
        WHERE MonitorId = @id AND CheckedAt >= DATEADD(DAY, -@days, SYSUTCDATETIME())
      )
      SELECT
        COUNT(*) AS TotalChecks,
        SUM(CASE WHEN Success = 1 THEN 1 ELSE 0 END) AS SuccessfulChecks,
        (SELECT TOP 1 TotalMs FROM Recent ORDER BY CheckedAt DESC) AS Current,
        AVG(CAST(TotalMs AS FLOAT)) AS Avg,
        MIN(TotalMs) AS Min,
        MAX(TotalMs) AS Max,
        (SELECT DISTINCT PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY TotalMs) OVER () FROM Recent) AS P50,
        (SELECT DISTINCT PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY TotalMs) OVER () FROM Recent) AS P90,
        (SELECT DISTINCT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY TotalMs) OVER () FROM Recent) AS P95,
        (SELECT DISTINCT PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY TotalMs) OVER () FROM Recent) AS P99
      FROM Recent
    `);

  const row = result.recordset[0];
  const uptimePercent = row.TotalChecks > 0 ? (row.SuccessfulChecks / row.TotalChecks) * 100 : null;

  return NextResponse.json({
    ok: true,
    data: {
      days,
      totalChecks: row.TotalChecks,
      successfulChecks: row.SuccessfulChecks,
      uptimePercent,
      currentMs: row.Current,
      avgMs: row.Avg,
      minMs: row.Min,
      maxMs: row.Max,
      p50Ms: row.P50,
      p90Ms: row.P90,
      p95Ms: row.P95,
      p99Ms: row.P99,
    },
  });
}
