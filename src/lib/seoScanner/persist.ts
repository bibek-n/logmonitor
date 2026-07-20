import { getDb, sql } from "@/lib/db";
import type { AdminSession } from "@/lib/requireAdmin";
import type { SeoScanReport } from "./shared";

export async function saveSeoScan(report: SeoScanReport, websiteId: number | null, admin: AdminSession): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("websiteId", sql.Int, websiteId)
    .input("targetUrl", sql.NVarChar, report.targetUrl)
    .input("score", sql.Int, report.score)
    .input("grade", sql.VarChar, report.grade)
    .input("findingsJson", sql.NVarChar, JSON.stringify(report.findings))
    .input("checksJson", sql.NVarChar, JSON.stringify(report.checks))
    .input("triggeredByUserId", sql.Int, admin.userId)
    .input("triggeredByUsername", sql.NVarChar, admin.username)
    .query<{ Id: number }>(`
      INSERT INTO SeoScans
        (WebsiteId, TargetUrl, Score, Grade, FindingsJson, ChecksJson, TriggeredByUserId, TriggeredByUsername)
      OUTPUT INSERTED.Id
      VALUES
        (@websiteId, @targetUrl, @score, @grade, @findingsJson, @checksJson, @triggeredByUserId, @triggeredByUsername)
    `);
  return result.recordset[0].Id;
}
