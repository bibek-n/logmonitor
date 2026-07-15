import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { VALID_SCAN_DEVICES, type WebsitePerformanceScanRow, type WebsitePerformanceResourceMetricsRow } from "@/lib/websitePerformance/shared";

type MergedScan = WebsitePerformanceScanRow & Partial<WebsitePerformanceResourceMetricsRow>;

// Lower-is-better for every timing/size/count metric; higher-is-better only for the scores.
const METRICS: { key: keyof MergedScan; label: string; higherIsBetter: boolean; decimals?: number }[] = [
  { key: "OverallScore", label: "Overall Score", higherIsBetter: true },
  { key: "TotalResponseTimeMs", label: "Response Time (ms)", higherIsBetter: false },
  { key: "TtfbMs", label: "Time to First Byte (ms)", higherIsBetter: false },
  { key: "FirstContentfulPaintMs", label: "First Contentful Paint (ms)", higherIsBetter: false },
  { key: "LargestContentfulPaintMs", label: "Largest Contentful Paint (ms)", higherIsBetter: false },
  { key: "CumulativeLayoutShift", label: "Cumulative Layout Shift", higherIsBetter: false, decimals: 3 },
  { key: "TotalBlockingTimeMs", label: "Total Blocking Time (ms)", higherIsBetter: false },
  { key: "SpeedIndexMs", label: "Speed Index (ms)", higherIsBetter: false },
  { key: "FullyLoadedMs", label: "Fully Loaded Time (ms)", higherIsBetter: false },
  { key: "TotalTransferredBytes", label: "Total Page Size (bytes)", higherIsBetter: false },
  { key: "TotalRequests", label: "Total Requests", higherIsBetter: false },
  { key: "JsBytes", label: "JavaScript Size (bytes)", higherIsBetter: false },
  { key: "ImageBytes", label: "Image Size (bytes)", higherIsBetter: false },
  { key: "FailedCount", label: "Failed Requests", higherIsBetter: false },
];

async function loadMerged(db: Awaited<ReturnType<typeof getDb>>, scan: WebsitePerformanceScanRow): Promise<MergedScan> {
  const res = await db.request().input("scanId", sql.Int, scan.Id).query<WebsitePerformanceResourceMetricsRow>(
    "SELECT * FROM WebsitePerformanceResourceMetrics WHERE ScanId = @scanId"
  );
  return { ...scan, ...(res.recordset[0] ?? {}) };
}

async function loadAverage(
  db: Awaited<ReturnType<typeof getDb>>,
  websiteId: number,
  device: string,
  days: number,
  excludeScanId: number
): Promise<MergedScan | null> {
  const scanResult = await db
    .request()
    .input("websiteId", sql.Int, websiteId)
    .input("device", sql.VarChar, device)
    .input("excludeId", sql.Int, excludeScanId)
    .input("days", sql.Int, days)
    .query<WebsitePerformanceScanRow>(`
      SELECT * FROM WebsitePerformanceScans
      WHERE WebsiteId = @websiteId AND Device = @device AND Status = 'Completed' AND Id != @excludeId
        AND CreatedAt >= DATEADD(DAY, -@days, SYSUTCDATETIME())
    `);
  if (scanResult.recordset.length === 0) return null;

  const merged = await Promise.all(scanResult.recordset.map((s) => loadMerged(db, s)));
  const avg: Record<string, number | null> = {};
  for (const m of METRICS) {
    const values = merged.map((row) => row[m.key]).filter((v): v is number => typeof v === "number");
    avg[m.key as string] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }
  return { ...merged[0], ...avg } as MergedScan;
}

function resultFor(previous: number | null, current: number | null, higherIsBetter: boolean): string {
  if (previous === null || current === null) return "NoPreviousData";
  if (previous === current) return "Unchanged";
  const improved = higherIsBetter ? current > previous : current < previous;
  return improved ? "Improved" : "Degraded";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ websiteId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const websiteId = Number((await params).websiteId);
  if (!Number.isInteger(websiteId)) return NextResponse.json({ ok: false, error: "Invalid websiteId." }, { status: 400 });

  const sp = req.nextUrl.searchParams;
  const device = sp.get("device") ?? "Mobile";
  if (!VALID_SCAN_DEVICES.has(device)) return NextResponse.json({ ok: false, error: "Invalid device." }, { status: 400 });
  const against = sp.get("against") ?? "previous";
  const scanIdParam = sp.get("scanId");

  const db = await getDb();

  let currentScan: WebsitePerformanceScanRow | null = null;
  if (scanIdParam) {
    const r = await db.request().input("id", sql.Int, Number(scanIdParam)).query<WebsitePerformanceScanRow>(
      "SELECT * FROM WebsitePerformanceScans WHERE Id = @id"
    );
    currentScan = r.recordset[0] ?? null;
  } else {
    const r = await db.request().input("websiteId", sql.Int, websiteId).input("device", sql.VarChar, device).query<WebsitePerformanceScanRow>(
      "SELECT TOP 1 * FROM WebsitePerformanceScans WHERE WebsiteId = @websiteId AND Device = @device AND Status = 'Completed' ORDER BY CreatedAt DESC"
    );
    currentScan = r.recordset[0] ?? null;
  }
  if (!currentScan) return NextResponse.json({ ok: false, error: "No completed scan found to compare." }, { status: 404 });

  const current = await loadMerged(db, currentScan);

  let previous: MergedScan | null = null;
  if (against === "7day" || against === "30day") {
    previous = await loadAverage(db, websiteId, device, against === "7day" ? 7 : 30, currentScan.Id);
  } else if (against === "previous") {
    const r = await db
      .request()
      .input("websiteId", sql.Int, websiteId)
      .input("device", sql.VarChar, device)
      .input("beforeDate", sql.DateTime2, currentScan.CreatedAt)
      .query<WebsitePerformanceScanRow>(
        "SELECT TOP 1 * FROM WebsitePerformanceScans WHERE WebsiteId = @websiteId AND Device = @device AND Status = 'Completed' AND CreatedAt < @beforeDate ORDER BY CreatedAt DESC"
      );
    if (r.recordset[0]) previous = await loadMerged(db, r.recordset[0]);
  } else if (against === "initial") {
    const r = await db.request().input("websiteId", sql.Int, websiteId).input("device", sql.VarChar, device).query<WebsitePerformanceScanRow>(
      "SELECT TOP 1 * FROM WebsitePerformanceScans WHERE WebsiteId = @websiteId AND Device = @device AND Status = 'Completed' ORDER BY CreatedAt ASC"
    );
    if (r.recordset[0] && r.recordset[0].Id !== currentScan.Id) previous = await loadMerged(db, r.recordset[0]);
  } else if (/^\d+$/.test(against)) {
    const r = await db.request().input("id", sql.Int, Number(against)).query<WebsitePerformanceScanRow>(
      "SELECT * FROM WebsitePerformanceScans WHERE Id = @id"
    );
    if (r.recordset[0]) previous = await loadMerged(db, r.recordset[0]);
  }

  const rows = METRICS.map((m) => {
    const prevValue = previous ? (previous[m.key] as number | null) : null;
    const currValue = current[m.key] as number | null;
    const diff = prevValue !== null && currValue !== null ? currValue - prevValue : null;
    const pct = prevValue !== null && currValue !== null && prevValue !== 0 ? (diff! / Math.abs(prevValue)) * 100 : null;
    return {
      metric: m.label,
      previous: prevValue !== null && m.decimals ? Number(prevValue.toFixed(m.decimals)) : prevValue,
      current: currValue !== null && m.decimals ? Number(currValue.toFixed(m.decimals)) : currValue,
      difference: diff !== null && m.decimals ? Number(diff.toFixed(m.decimals)) : diff,
      changePct: pct !== null ? Number(pct.toFixed(1)) : null,
      result: resultFor(prevValue, currValue, m.higherIsBetter),
    };
  });

  return NextResponse.json({
    ok: true,
    data: { device, against, currentScanId: currentScan.Id, previousScanId: previous?.Id ?? null, rows },
  });
}
