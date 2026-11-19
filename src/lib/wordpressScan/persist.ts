import { getDb, sql } from "@/lib/db";
import type { AdminSession } from "@/lib/requireAdmin";
import type { WordPressScanReport } from "./shared";
import { upsertFindingsForScan } from "./findings";

export async function saveWordPressScan(report: WordPressScanReport, websiteId: number | null, admin: AdminSession): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("websiteId", sql.Int, websiteId)
    .input("targetUrl", sql.NVarChar, report.targetUrl)
    .input("isWordPress", sql.Bit, report.isWordPress)
    .input("blockReason", sql.NVarChar, report.blockReason)
    .input("coreVersion", sql.NVarChar, report.coreVersion)
    .input("phpVersion", sql.NVarChar, report.phpVersion)
    .input("latestCoreVersion", sql.NVarChar, report.latestCoreVersion)
    .input("themeSlug", sql.NVarChar, report.themeSlug)
    .input("themeVersion", sql.NVarChar, report.themeVersion)
    .input("riskLevel", sql.VarChar, report.riskLevel)
    .input("findingsJson", sql.NVarChar, JSON.stringify(report.findings))
    .input("checksJson", sql.NVarChar, JSON.stringify(report.checks))
    .input("pluginsJson", sql.NVarChar, JSON.stringify(report.plugins))
    .input("profile", sql.VarChar, report.profile)
    .input("triggeredByUserId", sql.Int, admin.userId)
    .input("triggeredByUsername", sql.NVarChar, admin.username)
    .query<{ Id: number }>(`
      INSERT INTO WordPressDeepScans
        (WebsiteId, TargetUrl, IsWordPress, BlockReason, CoreVersion, PhpVersion, LatestCoreVersion, ThemeSlug, ThemeVersion, RiskLevel, FindingsJson, ChecksJson, PluginsJson, Profile, TriggeredByUserId, TriggeredByUsername)
      OUTPUT INSERTED.Id
      VALUES
        (@websiteId, @targetUrl, @isWordPress, @blockReason, @coreVersion, @phpVersion, @latestCoreVersion, @themeSlug, @themeVersion, @riskLevel, @findingsJson, @checksJson, @pluginsJson, @profile, @triggeredByUserId, @triggeredByUsername)
    `);
  const scanId = result.recordset[0].Id;

  if (websiteId !== null) {
    // Finding-status dedup is scoped per-website (FindingKey = WebsiteId|check|title) — an
    // ad-hoc scan against a URL not tied to a saved website has nothing stable to dedup
    // against across scans, so it's intentionally skipped here (same report/history still
    // works for it via FindingsJson above, it just won't appear in the Findings tracker).
    await upsertFindingsForScan(websiteId, scanId, report.findings);
  }

  return scanId;
}
