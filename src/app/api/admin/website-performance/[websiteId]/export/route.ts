import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { rowsToCsv } from "@/lib/csv";
import type { WebsitePerformanceScanRow } from "@/lib/websitePerformance/shared";

const HEADERS = [
  "Device", "Status", "TriggeredBy", "CreatedAt", "OverallScore", "CoreWebVitalsScore",
  "ServerResponseScore", "ResourceOptimizationScore", "UserExperienceScore",
  "TtfbMs", "FirstContentfulPaintMs", "LargestContentfulPaintMs", "CumulativeLayoutShift",
  "TotalBlockingTimeMs", "SpeedIndexMs", "TimeToInteractiveMs", "FullyLoadedMs",
  "TotalResponseTimeMs", "HttpStatusCode", "ResponseSizeBytes",
];

// Same file-download convention already used elsewhere (ticket attachments, website-security
// PDF reports, QA test-case CSV export) - no new pattern introduced.
export async function GET(req: NextRequest, { params }: { params: Promise<{ websiteId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const websiteId = Number((await params).websiteId);
  if (!Number.isInteger(websiteId)) return NextResponse.json({ ok: false, error: "Invalid websiteId." }, { status: 400 });

  const db = await getDb();
  const websiteResult = await db.request().input("id", sql.Int, websiteId).query<{ Name: string }>("SELECT Name FROM Websites WHERE Id = @id");
  const website = websiteResult.recordset[0];
  if (!website) return NextResponse.json({ ok: false, error: "Website not found." }, { status: 404 });

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
  const safeName = website.Name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="website-performance-${safeName}.csv"`,
    },
  });
}
