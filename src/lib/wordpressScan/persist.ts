import { getDb, sql } from "@/lib/db";
import type { AdminSession } from "@/lib/requireAdmin";
import type { WordPressScanReport } from "./shared";

export async function saveWordPressScan(report: WordPressScanReport, websiteId: number | null, admin: AdminSession): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("websiteId", sql.Int, websiteId)
    .input("targetUrl", sql.NVarChar, report.targetUrl)
    .input("isWordPress", sql.Bit, report.isWordPress)
    .input("coreVersion", sql.NVarChar, report.coreVersion)
    .input("themeSlug", sql.NVarChar, report.themeSlug)
    .input("themeVersion", sql.NVarChar, report.themeVersion)
    .input("riskLevel", sql.VarChar, report.riskLevel)
    .input("findingsJson", sql.NVarChar, JSON.stringify(report.findings))
    .input("checksJson", sql.NVarChar, JSON.stringify(report.checks))
    .input("pluginsJson", sql.NVarChar, JSON.stringify(report.plugins))
    .input("triggeredByUserId", sql.Int, admin.userId)
    .input("triggeredByUsername", sql.NVarChar, admin.username)
    .query<{ Id: number }>(`
      INSERT INTO WordPressDeepScans
        (WebsiteId, TargetUrl, IsWordPress, CoreVersion, ThemeSlug, ThemeVersion, RiskLevel, FindingsJson, ChecksJson, PluginsJson, TriggeredByUserId, TriggeredByUsername)
      OUTPUT INSERTED.Id
      VALUES
        (@websiteId, @targetUrl, @isWordPress, @coreVersion, @themeSlug, @themeVersion, @riskLevel, @findingsJson, @checksJson, @pluginsJson, @triggeredByUserId, @triggeredByUsername)
    `);
  return result.recordset[0].Id;
}
