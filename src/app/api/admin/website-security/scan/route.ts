import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { createScanRow, executeScan } from "@/lib/websiteSecurityAudit/runScan";
import { sendScanReportEmail } from "@/lib/websiteSecurityAudit/emailReport";

// Always responds 200 (see chat/agent routes elsewhere in this app) — this app's IIS front
// end replaces non-2xx response bodies with a generic HTML error page, which would
// otherwise hand the dashboard's res.json() an HTML document instead of {ok:false, error}.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const websiteId = Number(body?.websiteId);
  if (!Number.isInteger(websiteId) || websiteId <= 0) {
    return NextResponse.json({ ok: false, error: "websiteId is required" });
  }

  const db = await getDb();
  const websiteResult = await db
    .request()
    .input("id", sql.Int, websiteId)
    .query<{ Id: number; Name: string; Url: string }>("SELECT Id, Name, Url FROM Websites WHERE Id = @id");
  const website = websiteResult.recordset[0];
  if (!website) return NextResponse.json({ ok: false, error: "Website not found" });

  // A manual scan is an explicit admin action, so it's allowed to replace today's automated
  // scan (if any) rather than being blocked by it — remove today's row first (cascades to its
  // findings/report/email-log rows) so the UNIQUE(WebsiteId, ScanDate) constraint doesn't reject it.
  await db
    .request()
    .input("websiteId", sql.Int, websiteId)
    .query(`DELETE FROM WebsiteAuditScans WHERE WebsiteId = @websiteId AND ScanDate = CAST(SYSUTCDATETIME() AS DATE)`);

  const scanOpts = { websiteId, url: website.Url, triggeredByUserId: admin.userId, triggeredBy: admin.username };

  let scanId: number;
  try {
    scanId = await createScanRow(scanOpts);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to start scan" });
  }

  // Extracted now, synchronously, while `req` is still guaranteed valid — reading it from
  // inside the fire-and-forget continuation below (which can run 10-60+ seconds later,
  // long after this response has already been sent) previously threw, and the trailing
  // .catch(() => {}) silently swallowed that error before sendScanReportEmail ever ran. That
  // was the actual reason manual scans never emailed a report despite completing fine.
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  // Fire-and-forget: the full scan (WordPress plugin enumeration, OWASP crawler, per-TLS-
  // version probes, DNS/email/performance checks) can legitimately take a minute or more —
  // far longer than a single request should be held open through IIS/iisnode. The dashboard
  // polls /api/admin/website-security/scan-log/[scanId] for live progress and completion.
  // Each step below is independently try/caught and logged to console (captured by
  // iisnode's stderr log) — a failure in one must not silently prevent the other, and
  // neither should disappear without a trace the way they previously did.
  void executeScan(scanId, scanOpts).then(async (summary) => {
    try {
      await logAdminAction({
        admin,
        section: "website-security",
        action: "manual_scan",
        details: `${website.Name} — score ${summary.securityScore}, risk ${summary.riskLevel}`,
        ipAddress: clientIp,
      });
    } catch (err) {
      console.error(`[manual-scan] failed to log admin action for scan ${scanId}:`, err instanceof Error ? err.message : err);
    }

    try {
      // Manual scans previously never emailed a report — only the daily scheduled scan did.
      await sendScanReportEmail(scanId, "Manual Website Security Audit Report");
    } catch (err) {
      console.error(`[manual-scan] failed to send report email for scan ${scanId}:`, err instanceof Error ? err.message : err);
    }
  }).catch((err) => {
    // executeScan() itself already marks the row 'Failed' and logs to WebsiteAuditScanLog
    // before re-throwing — this only exists to catch that re-thrown rejection so it doesn't
    // reach Node as an unhandled promise rejection, while still leaving a trace of it.
    console.error(`[manual-scan] scan ${scanId} did not complete:`, err instanceof Error ? err.message : err);
  });

  return NextResponse.json({ ok: true, scanId });
}
