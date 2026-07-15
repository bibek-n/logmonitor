import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import {
  type WebsitePerformanceScanRow,
  type WebsitePerformanceResourceMetricsRow,
  type WebsiteOptimizationCheckRow,
  type WebsitePerformanceConfigRow,
} from "@/lib/websitePerformance/shared";

export async function GET(req: NextRequest, { params }: { params: Promise<{ websiteId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const websiteId = Number((await params).websiteId);
  if (!Number.isInteger(websiteId)) return NextResponse.json({ ok: false, error: "Invalid websiteId." }, { status: 400 });

  const db = await getDb();
  const websiteResult = await db.request().input("id", sql.Int, websiteId).query<{ Id: number; Name: string; Url: string; Enabled: boolean }>(
    "SELECT Id, Name, Url, Enabled FROM Websites WHERE Id = @id"
  );
  const website = websiteResult.recordset[0];
  if (!website) return NextResponse.json({ ok: false, error: "Website not found." }, { status: 404 });

  const configResult = await db.request().input("id", sql.Int, websiteId).query<WebsitePerformanceConfigRow>(
    "SELECT * FROM WebsitePerformanceConfigs WHERE WebsiteId = @id"
  );

  const devices = ["Mobile", "Desktop"] as const;
  const byDevice: Record<string, {
    scan: WebsitePerformanceScanRow | null;
    resources: WebsitePerformanceResourceMetricsRow | null;
    checks: WebsiteOptimizationCheckRow[];
  }> = {};

  for (const device of devices) {
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

    byDevice[device] = { scan, resources, checks };
  }

  const auditResult = await db.request().input("id", sql.Int, websiteId).query<{ SecurityScore: number | null; RiskLevel: string | null; ScanDate: string | null }>(
    "SELECT TOP 1 SecurityScore, RiskLevel, ScanDate FROM WebsiteAuditScans WHERE WebsiteId = @id AND Status = 'Completed' ORDER BY ScanDate DESC"
  );

  return NextResponse.json({
    ok: true,
    data: {
      website,
      config: configResult.recordset[0] ?? null,
      byDevice,
      latestAudit: auditResult.recordset[0] ?? null,
    },
  });
}
