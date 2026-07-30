import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { rowsToCsv } from "@/lib/csv";
import {
  VALID_SCAN_DEVICES,
  type WebsitePerformanceScanRow,
  type WebsitePerformanceResourceMetricsRow,
  type WebsiteOptimizationCheckRow,
} from "@/lib/websitePerformance/shared";
import { generatePerformanceReportPdf, performanceReportFilename } from "@/lib/websitePerformance/reportPdf";

const HEADERS = [
  "Device", "Status", "TriggeredBy", "CreatedAt", "OverallScore", "CoreWebVitalsScore",
  "ServerResponseScore", "ResourceOptimizationScore", "UserExperienceScore",
  "TtfbMs", "FirstContentfulPaintMs", "LargestContentfulPaintMs", "CumulativeLayoutShift",
  "TotalBlockingTimeMs", "SpeedIndexMs", "TimeToInteractiveMs", "FullyLoadedMs",
  "TotalResponseTimeMs", "HttpStatusCode", "ResponseSizeBytes",
];

async function exportCsv(websiteId: number, websiteName: string) {
  const db = await getDb();
  const scansResult = await db.request().input("websiteId", sql.Int, websiteId).query<WebsitePerformanceScanRow>(
    "SELECT TOP 500 * FROM WebsitePerformanceScans WHERE WebsiteId = @websiteId ORDER BY CreatedAt DESC"
  );

  const rows = scansResult.recordset.map((s) => [
    s.Device, s.Status, s.TriggeredBy, s.CreatedAt, s.OverallScore, s.CoreWebVitalsScore,
    s.ServerResponseScore, s.ResourceOptimizationScore, s.UserExperienceScore,
    s.TtfbMs, s.FirstContentfulPaintMs, s.LargestContentfulPaintMs, s.CumulativeLayoutShift,
    s.TotalBlockingTimeMs, s.SpeedIndexMs, s.TimeToInteractiveMs, s.FullyLoadedMs,
    s.TotalResponseTimeMs, s.HttpStatusCode, s.ResponseSizeBytes,
  ]);

  const csv = rowsToCsv(HEADERS, rows);
  const safeName = websiteName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="website-performance-${safeName}.csv"`,
    },
  });
}

// One device's latest scan + resource metrics + optimization checks + recent score history,
// rendered as a printable PDF - see reportPdf.ts. Narrower in scope than the CSV export (which
// dumps up to 500 raw scan rows across both devices) because a PDF is meant to be read, not
// data-mined; the CSV remains the tool for bulk/trend analysis.
async function exportPdf(websiteId: number, websiteName: string, websiteUrl: string, device: string) {
  const db = await getDb();

  const scanResult = await db
    .request()
    .input("websiteId", sql.Int, websiteId)
    .input("device", sql.VarChar, device)
    .query<WebsitePerformanceScanRow>(
      "SELECT TOP 1 * FROM WebsitePerformanceScans WHERE WebsiteId = @websiteId AND Device = @device ORDER BY CreatedAt DESC"
    );
  const scan = scanResult.recordset[0] ?? null;

  let resources: WebsitePerformanceResourceMetricsRow | null = null;
  let checks: WebsiteOptimizationCheckRow[] = [];
  if (scan) {
    const resourceResult = await db.request().input("scanId", sql.Int, scan.Id).query<WebsitePerformanceResourceMetricsRow>(
      "SELECT * FROM WebsitePerformanceResourceMetrics WHERE ScanId = @scanId"
    );
    resources = resourceResult.recordset[0] ?? null;

    const checksResult = await db.request().input("scanId", sql.Int, scan.Id).query<WebsiteOptimizationCheckRow>(
      "SELECT * FROM WebsiteOptimizationChecks WHERE ScanId = @scanId ORDER BY CASE Severity WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 3 ELSE 4 END"
    );
    checks = checksResult.recordset;
  }

  const historyResult = await db
    .request()
    .input("websiteId", sql.Int, websiteId)
    .input("device", sql.VarChar, device)
    .query<WebsitePerformanceScanRow>(
      "SELECT TOP 20 * FROM WebsitePerformanceScans WHERE WebsiteId = @websiteId AND Device = @device AND Status = 'Completed' ORDER BY CreatedAt DESC"
    );

  const buffer = await generatePerformanceReportPdf({
    websiteName,
    websiteUrl,
    device,
    scan,
    resources,
    checks,
    history: historyResult.recordset,
  });

  const filename = performanceReportFilename(websiteName, device, (scan?.CreatedAt ?? new Date().toISOString()).slice(0, 10));
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// Same file-download convention already used elsewhere (ticket attachments, website-security
// PDF reports, QA test-case CSV export) - no new pattern introduced. Defaults to CSV
// (unchanged behavior for the existing "Export CSV" button) when ?format is omitted.
export async function GET(req: NextRequest, { params }: { params: Promise<{ websiteId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const websiteId = Number((await params).websiteId);
  if (!Number.isInteger(websiteId)) return NextResponse.json({ ok: false, error: "Invalid websiteId." }, { status: 400 });

  const format = req.nextUrl.searchParams.get("format") ?? "csv";
  const device = req.nextUrl.searchParams.get("device") ?? "Mobile";
  if (format === "pdf" && !VALID_SCAN_DEVICES.has(device)) {
    return NextResponse.json({ ok: false, error: "Invalid device filter." }, { status: 400 });
  }

  const db = await getDb();
  const websiteResult = await db.request().input("id", sql.Int, websiteId).query<{ Name: string; Url: string }>("SELECT Name, Url FROM Websites WHERE Id = @id");
  const website = websiteResult.recordset[0];
  if (!website) return NextResponse.json({ ok: false, error: "Website not found." }, { status: 404 });

  if (format === "pdf") return exportPdf(websiteId, website.Name, website.Url, device);
  return exportCsv(websiteId, website.Name);
}
