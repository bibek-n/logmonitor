import "dotenv/config";
import { getDb, sql } from "../src/lib/db";
import { createScanRow, executeScan } from "../src/lib/websiteSecurityAudit/runScan";
import { sendScanReportEmail } from "../src/lib/websiteSecurityAudit/emailReport";

// One-off on-demand "scan everything now" trigger, requested directly by the user rather than
// waiting for the ~02:00 scheduled run. Sequential (same as run-website-security-daily-scan.ts)
// to match the server load profile that script is already tuned for.
async function main() {
  const db = await getDb();
  const websitesResult = await db.query<{ Id: number; Name: string; Url: string }>(
    "SELECT Id, Name, Url FROM Websites WHERE Enabled = 1 ORDER BY Name"
  );
  const websites = websitesResult.recordset;
  console.log(`[trigger-all] ${websites.length} enabled website(s) to scan.`);

  let done = 0;
  for (const website of websites) {
    console.log(`[trigger-all] (${++done}/${websites.length}) ${website.Name}: scanning...`);
    await db
      .request()
      .input("websiteId", sql.Int, website.Id)
      .query("DELETE FROM WebsiteAuditScans WHERE WebsiteId = @websiteId AND ScanDate = CAST(SYSUTCDATETIME() AS DATE)");

    const scanOpts = { websiteId: website.Id, url: website.Url, triggeredByUserId: null, triggeredBy: "manual-trigger-all" };
    try {
      const scanId = await createScanRow(scanOpts);
      const summary = await executeScan(scanId, scanOpts);
      await sendScanReportEmail(scanId, "Manual Website Security Audit Report");
      await db
        .request()
        .input("websiteId", sql.Int, website.Id)
        .input("scanId", sql.Int, scanId)
        .query(
          "INSERT INTO WebsiteAuditActivityLogs (WebsiteId, ScanId, Action, ActorName) VALUES (@websiteId, @scanId, 'manual_scan_all_completed', 'manual-trigger-all')"
        );
      console.log(`[trigger-all] ${website.Name}: done — score ${summary.securityScore}, risk ${summary.riskLevel}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[trigger-all] ${website.Name}: FAILED —`, message);
    }
  }

  console.log(`[trigger-all] all ${websites.length} website(s) processed.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
