import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";

// Response-time percentiles over the requested window, plus uptime % computed from actual
// check outcomes (not just "number of failed checks" - spec section 22 draws the same
// distinction for SLA calculation, though full SLA-target tracking is Phase 4; this endpoint
// only reports the raw percentages a Phase 1 monitor detail page needs).
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

  // Not window-restricted - the latest check's reason regardless of the uptime window picked
  // above. Surfaces WAF-challenge/empty-body/content-check failures by name on the Overview
  // tab instead of a bare Down/Pending status with no explanation (see websiteChecker.ts's
  // errorCode fix for why these were often blank before).
  const latestResult = await db
    .request()
    .input("id", sql.Int, Number(id))
    .query<{ ErrorCode: string | null; ErrorMessage: string | null }>(
      "SELECT TOP 1 ErrorCode, ErrorMessage FROM MonitorResults WHERE MonitorId = @id ORDER BY CheckedAt DESC"
    );
  const latest = latestResult.recordset[0];

  // Response-time chart data: hourly buckets keep a 7-day window to ~168 points and a 90-day
  // window to ~2160 - fine for a line chart, and matches the hourly-bucket convention already
  // used elsewhere in this app (e.g. the Security Center score trend).
  const seriesResult = await db
    .request()
    .input("id", sql.Int, Number(id))
    .input("days", sql.Int, days)
    .query<{ Bucket: string; AvgMs: number | null }>(`
      SELECT CONVERT(VARCHAR(13), CheckedAt, 126) AS Bucket, AVG(CAST(TotalMs AS FLOAT)) AS AvgMs
      FROM MonitorResults
      WHERE MonitorId = @id AND CheckedAt >= DATEADD(DAY, -@days, SYSUTCDATETIME()) AND TotalMs IS NOT NULL
      GROUP BY CONVERT(VARCHAR(13), CheckedAt, 126)
      ORDER BY Bucket ASC
    `);

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
      series: seriesResult.recordset.map((r) => ({ bucket: r.Bucket, avgMs: r.AvgMs })),
      latestErrorCode: latest?.ErrorCode ?? null,
      latestErrorMessage: latest?.ErrorMessage ?? null,
    },
  });
}
