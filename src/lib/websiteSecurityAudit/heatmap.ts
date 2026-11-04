import { getDb } from "@/lib/db";
import type { ScoreModule, Severity } from "./types";

const SEVERITY_DEDUCTION: Record<Severity, number> = { critical: 20, high: 12, medium: 6, low: 2, info: 0 };
const ALL_MODULES: ScoreModule[] = ["headers", "ssl", "auth", "cookies", "js", "dns", "email", "server", "owasp", "performance"];

export interface WebsiteHeatmapRow {
  websiteId: number;
  websiteName: string;
  scanDate: string | null;
  moduleScores: Record<ScoreModule, number>;
}

// Same deduct-from-100 math as scoring.ts's computeModuleScores(), but driven off a single
// grouped-count query across all three finding tables for every website's latest completed
// scan at once, instead of loading each website's full finding rows one at a time (which is
// what loadScanDetail does per-scan) - that would be N extra round trips for an "all
// websites at a glance" grid.
export async function getWebsiteSecurityHeatmap(): Promise<WebsiteHeatmapRow[]> {
  const db = await getDb();

  const websitesResult = await db.query<{ Id: number; Name: string; LatestScanId: number | null; LatestScanDate: string | null }>(`
    SELECT w.Id, w.Name, latest.Id AS LatestScanId, latest.ScanDate AS LatestScanDate
    FROM Websites w
    OUTER APPLY (
      SELECT TOP 1 s.Id, s.ScanDate FROM WebsiteAuditScans s
      WHERE s.WebsiteId = w.Id AND s.Status = 'Completed'
      ORDER BY s.ScanDate DESC, s.Id DESC
    ) latest
    WHERE w.Enabled = 1
    ORDER BY w.Name
  `);

  const scanIds = websitesResult.recordset.map((w) => w.LatestScanId).filter((id): id is number => id !== null);
  const scanIdToWebsiteId = new Map(websitesResult.recordset.filter((w) => w.LatestScanId !== null).map((w) => [w.LatestScanId as number, w.Id]));

  const countsByWebsite = new Map<number, Record<string, number>>(); // websiteId -> "module|severity" -> count

  if (scanIds.length > 0) {
    const idList = scanIds.join(",");
    const groupedResult = await db.query<{ ScanId: number; Module: string | null; Severity: string; Cnt: number }>(`
      SELECT ScanId, Module, Severity, COUNT(*) AS Cnt FROM (
        SELECT ScanId, Module, Severity FROM WebsiteAuditFindings WHERE ScanId IN (${idList})
        UNION ALL
        SELECT ScanId, Module, Severity FROM WebsiteDependencyFindings WHERE ScanId IN (${idList})
        UNION ALL
        SELECT ScanId, Module, Severity FROM WebsiteCodeFindings WHERE ScanId IN (${idList})
      ) all_findings
      GROUP BY ScanId, Module, Severity
    `);

    for (const row of groupedResult.recordset) {
      if (!row.Module) continue;
      const websiteId = scanIdToWebsiteId.get(row.ScanId);
      if (websiteId === undefined) continue;
      const bucket = countsByWebsite.get(websiteId) ?? {};
      bucket[`${row.Module}|${row.Severity}`] = row.Cnt;
      countsByWebsite.set(websiteId, bucket);
    }
  }

  return websitesResult.recordset.map((w) => {
    const bucket = countsByWebsite.get(w.Id) ?? {};
    const moduleScores = {} as Record<ScoreModule, number>;
    for (const mod of ALL_MODULES) {
      let score = 100;
      for (const sev of Object.keys(SEVERITY_DEDUCTION) as Severity[]) {
        const cnt = bucket[`${mod}|${sev}`] ?? 0;
        score -= SEVERITY_DEDUCTION[sev] * cnt;
      }
      moduleScores[mod] = Math.max(0, Math.round(score));
    }
    return { websiteId: w.Id, websiteName: w.Name, scanDate: w.LatestScanDate, moduleScores };
  });
}

export { ALL_MODULES };
