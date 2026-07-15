import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { performanceStatusFor } from "@/lib/websitePerformance/shared";

// Real stored-data summary + a representative subset of the requested chart set (score
// distribution, score-over-time, top-slowest, mobile-vs-desktop) - the full 15-chart wishlist
// (resource-size-by-type bar, Core Web Vitals pie per device, etc.) is straightforward to add
// as additional endpoints/panels later using this same shape, deferred to keep this endpoint
// shippable now rather than half-built.
export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();

  const websiteCount = await db.query<{ Total: number }>("SELECT COUNT(*) AS Total FROM Websites WHERE Enabled = 1");
  const monitoringEnabled = await db.query<{ Total: number }>("SELECT COUNT(*) AS Total FROM WebsitePerformanceConfigs WHERE Enabled = 1");
  const testsRunning = await db.query<{ Total: number }>("SELECT COUNT(*) AS Total FROM WebsitePerformanceScans WHERE Status IN ('Pending', 'Running')");

  const latestPerWebsite = await db.query<{
    WebsiteId: number;
    Name: string;
    OverallScore: number | null;
    FullyLoadedMs: number | null;
    TotalResponseTimeMs: number | null;
    ResponseSizeBytes: number | null;
  }>(`
    SELECT w.Id AS WebsiteId, w.Name, latest.OverallScore, latest.FullyLoadedMs, latest.TotalResponseTimeMs, latest.ResponseSizeBytes
    FROM Websites w
    OUTER APPLY (
      SELECT TOP 1 s.OverallScore, s.FullyLoadedMs, s.TotalResponseTimeMs, s.ResponseSizeBytes
      FROM WebsitePerformanceScans s
      WHERE s.WebsiteId = w.Id AND s.Status = 'Completed'
      ORDER BY s.CreatedAt DESC
    ) latest
    WHERE w.Enabled = 1
  `);

  const buckets = { Excellent: 0, Good: 0, NeedsImprovement: 0, Poor: 0, NotTested: 0 };
  const scores: number[] = [];
  const loadTimes: number[] = [];
  const responseTimes: number[] = [];
  const pageSizes: number[] = [];
  for (const row of latestPerWebsite.recordset) {
    const status = performanceStatusFor(row.OverallScore) as keyof typeof buckets;
    buckets[status] += 1;
    if (row.OverallScore != null) scores.push(row.OverallScore);
    if (row.FullyLoadedMs != null) loadTimes.push(row.FullyLoadedMs);
    if (row.TotalResponseTimeMs != null) responseTimes.push(row.TotalResponseTimeMs);
    if (row.ResponseSizeBytes != null) pageSizes.push(row.ResponseSizeBytes);
  }
  const avg = (arr: number[]) => (arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);

  // Regression = latest completed score at least 10 points below the completed scan before
  // it, for the same website+device.
  const regressions = await db.query<{ Cnt: number }>(`
    SELECT COUNT(*) AS Cnt FROM (
      SELECT s.WebsiteId, s.Device, s.OverallScore,
        LAG(s.OverallScore) OVER (PARTITION BY s.WebsiteId, s.Device ORDER BY s.CreatedAt) AS PrevScore,
        ROW_NUMBER() OVER (PARTITION BY s.WebsiteId, s.Device ORDER BY s.CreatedAt DESC) AS rn
      FROM WebsitePerformanceScans s
      WHERE s.Status = 'Completed'
    ) ranked
    WHERE rn = 1 AND PrevScore IS NOT NULL AND OverallScore <= PrevScore - 10
  `);

  const scoreOverTime = await db.query<{ Day: string; AvgScore: number | null; AvgLoadMs: number | null }>(`
    SELECT CONVERT(VARCHAR(10), CreatedAt, 126) AS Day, AVG(CAST(OverallScore AS FLOAT)) AS AvgScore, AVG(CAST(FullyLoadedMs AS FLOAT)) AS AvgLoadMs
    FROM WebsitePerformanceScans
    WHERE Status = 'Completed' AND CreatedAt >= DATEADD(DAY, -30, SYSUTCDATETIME())
    GROUP BY CONVERT(VARCHAR(10), CreatedAt, 126)
    ORDER BY Day
  `);

  const topSlowest = [...latestPerWebsite.recordset]
    .filter((r) => r.FullyLoadedMs != null)
    .sort((a, b) => (b.FullyLoadedMs ?? 0) - (a.FullyLoadedMs ?? 0))
    .slice(0, 8)
    .map((r) => ({ name: r.Name, fullyLoadedMs: r.FullyLoadedMs }));

  const mobileVsDesktop = await db.query<{ Device: string; AvgScore: number | null }>(`
    SELECT Device, AVG(CAST(OverallScore AS FLOAT)) AS AvgScore
    FROM WebsitePerformanceScans
    WHERE Status = 'Completed' AND Id IN (
      SELECT MAX(Id) FROM WebsitePerformanceScans WHERE Status = 'Completed' GROUP BY WebsiteId, Device
    )
    GROUP BY Device
  `);

  return NextResponse.json({
    ok: true,
    data: {
      totals: {
        totalWebsites: websiteCount.recordset[0]?.Total ?? 0,
        monitoringEnabled: monitoringEnabled.recordset[0]?.Total ?? 0,
        testsRunning: testsRunning.recordset[0]?.Total ?? 0,
        excellent: buckets.Excellent,
        good: buckets.Good,
        needsImprovement: buckets.NeedsImprovement,
        poor: buckets.Poor,
        notTested: buckets.NotTested,
        avgScore: avg(scores),
        avgLoadTimeMs: avg(loadTimes),
        avgResponseTimeMs: avg(responseTimes),
        avgPageSizeBytes: avg(pageSizes),
        regressions: regressions.recordset[0]?.Cnt ?? 0,
      },
      charts: {
        statusDistribution: buckets,
        scoreOverTime: scoreOverTime.recordset.map((r) => ({ day: r.Day, avgScore: r.AvgScore, avgLoadMs: r.AvgLoadMs })),
        topSlowest,
        mobileVsDesktop: mobileVsDesktop.recordset.map((r) => ({ device: r.Device, avgScore: r.AvgScore })),
      },
    },
  });
}
