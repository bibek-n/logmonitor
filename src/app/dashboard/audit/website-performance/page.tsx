import { getDb } from "@/lib/db";
import WebsitePerformanceClient, { type WebsitePerformanceSummary } from "@/components/websitePerformance/WebsitePerformanceClient";

export const dynamic = "force-dynamic";

// Reads FROM the existing Websites table (same one Audit/SSL/Header-Viewer/GA-Tag-Finder
// already use) - no new website registry. Mirrors website-security/page.tsx's thin
// server-component-fetches-then-hands-to-client-component shape.
export default async function WebsitePerformancePage() {
  const db = await getDb();
  const result = await db.query<WebsitePerformanceSummary>(`
    SELECT w.Id, w.Name, w.Url, w.Enabled,
      ISNULL(cfg.Enabled, 0) AS PerfEnabled,
      cfg.TestDevice,
      latest.OverallScore AS LatestScore,
      latest.ScanStatus AS LatestScanStatus,
      CONVERT(VARCHAR(19), latest.CreatedAt, 126) AS LatestTestedAt,
      audit.SecurityScore AS LatestAuditScore,
      audit.RiskLevel AS LatestAuditRiskLevel
    FROM Websites w
    LEFT JOIN WebsitePerformanceConfigs cfg ON cfg.WebsiteId = w.Id
    OUTER APPLY (
      SELECT TOP 1 s.OverallScore, s.Status AS ScanStatus, s.CreatedAt
      FROM WebsitePerformanceScans s
      WHERE s.WebsiteId = w.Id
      ORDER BY s.CreatedAt DESC
    ) latest
    OUTER APPLY (
      SELECT TOP 1 a.SecurityScore, a.RiskLevel
      FROM WebsiteAuditScans a
      WHERE a.WebsiteId = w.Id AND a.Status = 'Completed'
      ORDER BY a.ScanDate DESC
    ) audit
    WHERE w.Enabled = 1
    ORDER BY w.Name
  `);

  return (
    <div>
      <h1>Website Speed &amp; Performance</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Real-browser page speed testing (Core Web Vitals, resource breakdown, optimization checks) for every website
        already registered under Audit &gt; Websites. Powered by Google PageSpeed Insights (Lighthouse) - no separate
        website list to manage, and no local browser automation running on this server.
      </p>
      <WebsitePerformanceClient websites={result.recordset} />
    </div>
  );
}
