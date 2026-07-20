import { getDb } from "@/lib/db";
import WebsiteSecurityAuditClient, { type WebsiteSummary } from "@/components/websiteSecurity/WebsiteSecurityAuditClient";

export const dynamic = "force-dynamic";

export default async function WebsiteSecurityAuditPage() {
  const db = await getDb();
  const result = await db.query<WebsiteSummary>(`
    SELECT w.Id, w.Name, w.Url,
           latest.Id AS LatestScanId, latest.ScanDate AS LatestScanDate, latest.Status AS LatestStatus,
           latest.DetectedPlatform AS LatestPlatform, latest.SecurityScore AS LatestScore, latest.RiskLevel AS LatestRisk,
           sched.ScheduleType AS ScheduleType
    FROM Websites w
    OUTER APPLY (
      SELECT TOP 1 s.Id, s.ScanDate, s.Status, s.DetectedPlatform, s.SecurityScore, s.RiskLevel
      FROM WebsiteAuditScans s
      WHERE s.WebsiteId = w.Id
      ORDER BY s.ScanDate DESC, s.Id DESC
    ) latest
    LEFT JOIN WebsiteScanSchedules sched ON sched.WebsiteId = w.Id
    WHERE w.Enabled = 1
    ORDER BY w.Name
  `);

  return (
    <div>
      <h1>Website Security Audit</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Runs safe, non-destructive checks (security headers, cookies, CORS, HTTP methods, exposed files, mixed
        content, TLS, plus optional dependency/source-code checks when a lockfile or snippet is supplied) against
        every enabled website, scores the result, and emails a PDF report daily. No brute-force, password, denial-of-
        service, or destructive testing is ever performed. Any secret found is masked everywhere it's shown.
      </p>
      <WebsiteSecurityAuditClient websites={result.recordset} />
    </div>
  );
}
