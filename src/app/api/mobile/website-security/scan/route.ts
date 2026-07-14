import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireMobileAdmin, isMobileSession } from "@/lib/mobileAuth";
import { logAdminAction } from "@/lib/adminAudit";
import { createScanRow, executeScan } from "@/lib/websiteSecurityAudit/runScan";
import { sendScanReportEmail } from "@/lib/websiteSecurityAudit/emailReport";

// Mirrors /api/admin/website-security/scan/route.ts - same fire-and-forget pattern (a full
// scan can take a minute or more, far longer than a single request should be held open
// through IIS/iisnode). The app polls the existing scan-log endpoint for progress, same as
// the web dashboard does.
export async function POST(req: NextRequest) {
  const admin = await requireMobileAdmin(req);
  if (!isMobileSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const websiteId = Number(body?.websiteId);
  if (!Number.isInteger(websiteId) || websiteId <= 0) {
    return NextResponse.json({ ok: false, error: "websiteId is required" });
  }

  try {
    const db = await getDb();
    const websiteResult = await db
      .request()
      .input("id", sql.Int, websiteId)
      .query<{ Id: number; Name: string; Url: string }>("SELECT Id, Name, Url FROM Websites WHERE Id = @id");
    const website = websiteResult.recordset[0];
    if (!website) return NextResponse.json({ ok: false, error: "Website not found" });

    await db
      .request()
      .input("websiteId", sql.Int, websiteId)
      .query(`DELETE FROM WebsiteAuditScans WHERE WebsiteId = @websiteId AND ScanDate = CAST(SYSUTCDATETIME() AS DATE)`);

    const scanOpts = { websiteId, url: website.Url, triggeredByUserId: admin.userId, triggeredBy: admin.username };
    const scanId = await createScanRow(scanOpts);

    void executeScan(scanId, scanOpts)
      .then(async (summary) => {
        try {
          await logAdminAction({
            admin,
            section: "website-security",
            action: "manual_scan_mobile",
            details: `${website.Name} - score ${summary.securityScore}, risk ${summary.riskLevel}`,
            ipAddress: null,
          });
        } catch (err) {
          console.error(`[mobile-scan] failed to log admin action for scan ${scanId}:`, err instanceof Error ? err.message : err);
        }
        try {
          await sendScanReportEmail(scanId, "Manual Website Security Audit Report (Mobile)");
        } catch (err) {
          console.error(`[mobile-scan] failed to send report email for scan ${scanId}:`, err instanceof Error ? err.message : err);
        }
      })
      .catch((err) => {
        console.error(`[mobile-scan] scan ${scanId} did not complete:`, err instanceof Error ? err.message : err);
      });

    return NextResponse.json({ ok: true, scanId });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to start scan" });
  }
}
