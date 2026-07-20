import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { loadScanDetail } from "@/lib/websiteSecurityAudit/scanDetail";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ websiteId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { websiteId: websiteIdParam } = await params;
  const websiteId = Number(websiteIdParam);
  if (!Number.isInteger(websiteId) || websiteId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid website id" }, { status: 400 });
  }

  const db = await getDb();

  const websiteResult = await db
    .request()
    .input("id", sql.Int, websiteId)
    .query<{ Id: number; Name: string; Url: string; Enabled: boolean }>("SELECT Id, Name, Url, Enabled FROM Websites WHERE Id = @id");
  const website = websiteResult.recordset[0];
  if (!website) return NextResponse.json({ ok: false, error: "Website not found" }, { status: 404 });

  const historyResult = await db
    .request()
    .input("websiteId", sql.Int, websiteId)
    .query<{
      Id: number;
      ScanDate: string;
      Status: string;
      SecurityScore: number | null;
      RiskLevel: string | null;
      DetectedPlatform: string | null;
      HasReport: number;
    }>(`
      SELECT s.Id, s.ScanDate, s.Status, s.SecurityScore, s.RiskLevel, s.DetectedPlatform,
             CASE WHEN r.Id IS NULL THEN 0 ELSE 1 END AS HasReport
      FROM WebsiteAuditScans s
      LEFT JOIN WebsiteAuditReports r ON r.ScanId = s.Id
      WHERE s.WebsiteId = @websiteId
      ORDER BY s.ScanDate DESC, s.Id DESC
    `);

  const sourceInputResult = await db
    .request()
    .input("websiteId", sql.Int, websiteId)
    .query<{ LockfileFilename: string | null; UpdatedAt: string }>(
      "SELECT LockfileFilename, UpdatedAt FROM WebsiteAuditSourceInputs WHERE WebsiteId = @websiteId"
    );
  const sourceInput = sourceInputResult.recordset[0] ?? null;

  const latestScanId = historyResult.recordset.find((s) => s.Status === "Completed")?.Id ?? null;
  const latestDetail = latestScanId ? await loadScanDetail(latestScanId) : null;

  let emailLogs: { ToAddress: string; Success: boolean; SentAt: string }[] = [];
  if (latestScanId) {
    const emailResult = await db
      .request()
      .input("scanId", sql.Int, latestScanId)
      .query<{ ToAddress: string; Success: boolean; SentAt: string }>(
        "SELECT ToAddress, Success, SentAt FROM WebsiteAuditEmailLogs WHERE ScanId = @scanId ORDER BY SentAt DESC"
      );
    emailLogs = emailResult.recordset;
  }

  return NextResponse.json({
    ok: true,
    website,
    history: historyResult.recordset,
    sourceInput,
    latestDetail,
    emailLogs,
  });
}
