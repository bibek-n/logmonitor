import { getDb, sql } from "@/lib/db";
import type { CodeFinding, DependencyFinding, Finding, PreviousScanSummary, RiskLevel } from "./types";
import { buildRecommendations, buildRemediationRoadmap, computeModuleScores, type ModuleScores, type RemediationRoadmap } from "./scoring";

export interface ScanHistoryPoint {
  scanDate: string;
  securityScore: number;
  riskLevel: RiskLevel;
}

export interface ScanDetail {
  scanId: number;
  websiteId: number;
  websiteName: string;
  websiteUrl: string;
  scanDate: string;
  status: string;
  detectedPlatform: string;
  securityScore: number;
  riskLevel: RiskLevel;
  scanDurationMs: number | null;
  websiteStatus: string | null;
  hostingProvider: string | null;
  asn: string | null;
  ipAddress: string | null;
  ipv6Address: string | null;
  moduleScores: ModuleScores;
  findings: Finding[];
  dependencyFindings: DependencyFinding[];
  codeFindings: CodeFinding[];
  recommendations: string[];
  remediationRoadmap: RemediationRoadmap;
  previousScan: PreviousScanSummary | null;
  scanHistory: ScanHistoryPoint[];
}

const ENTERPRISE_FINDING_COLUMNS = `Cvss as cvss, Cwe as cwe, OwaspCategory as owaspCategory, Confidence as confidence, AffectedUrl as affectedUrl, Parameter as parameter, HttpMethod as httpMethod, Module as module, HttpRequestSnippet as httpRequestSnippet, HttpResponseSnippet as httpResponseSnippet`;

// Reads back everything a completed scan produced — shared by the Website Security Audit
// page (scan history detail), the authenticated PDF-report route, and the daily-scan script
// (report generation + email), so all three render from the exact same data.
export async function loadScanDetail(scanId: number): Promise<ScanDetail | null> {
  const db = await getDb();

  const scanResult = await db.request().input("scanId", sql.Int, scanId).query<{
    Id: number;
    WebsiteId: number;
    ScanDate: Date;
    Status: string;
    DetectedPlatform: string | null;
    SecurityScore: number | null;
    RiskLevel: string | null;
    ScanDurationMs: number | null;
    WebsiteStatus: string | null;
    HostingProvider: string | null;
    Asn: string | null;
    IpAddress: string | null;
    Ipv6Address: string | null;
    WebsiteName: string;
    WebsiteUrl: string;
  }>(`
    SELECT s.Id, s.WebsiteId, s.ScanDate, s.Status, s.DetectedPlatform, s.SecurityScore, s.RiskLevel,
           s.ScanDurationMs, s.WebsiteStatus, s.HostingProvider, s.Asn, s.IpAddress, s.Ipv6Address,
           w.Name AS WebsiteName, w.Url AS WebsiteUrl
    FROM WebsiteAuditScans s
    JOIN Websites w ON w.Id = s.WebsiteId
    WHERE s.Id = @scanId
  `);
  const scan = scanResult.recordset[0];
  if (!scan) return null;

  const [findingsResult, depResult, codeResult, prevResult, historyResult] = await Promise.all([
    db
      .request()
      .input("scanId", sql.Int, scanId)
      .query<
        { category: string; severity: string; title: string; description: string | null; evidence: string | null; recommendation: string | null } & Record<
          string,
          unknown
        >
      >(
        `SELECT Category as category, Severity as severity, Title as title, Description as description, Evidence as evidence, Recommendation as recommendation, ${ENTERPRISE_FINDING_COLUMNS} FROM WebsiteAuditFindings WHERE ScanId = @scanId`
      ),
    db
      .request()
      .input("scanId", sql.Int, scanId)
      .query<
        {
          packageName: string;
          currentVersion: string | null;
          recommendedVersion: string | null;
          ecosystem: string;
          severity: string;
          cveIds: string | null;
          reason: string;
        } & Record<string, unknown>
      >(
        `SELECT PackageName as packageName, CurrentVersion as currentVersion, RecommendedVersion as recommendedVersion, Ecosystem as ecosystem, Severity as severity, CveIds as cveIds, Reason as reason, Cvss as cvss, Cwe as cwe, OwaspCategory as owaspCategory, Confidence as confidence, Module as module FROM WebsiteDependencyFindings WHERE ScanId = @scanId`
      ),
    db
      .request()
      .input("scanId", sql.Int, scanId)
      .query<
        { category: string; severity: string; location: string | null; maskedEvidence: string; recommendation: string } & Record<string, unknown>
      >(
        `SELECT Category as category, Severity as severity, Location as location, MaskedEvidence as maskedEvidence, Recommendation as recommendation, Cvss as cvss, Cwe as cwe, OwaspCategory as owaspCategory, Confidence as confidence, Module as module FROM WebsiteCodeFindings WHERE ScanId = @scanId`
      ),
    db
      .request()
      .input("websiteId", sql.Int, scan.WebsiteId)
      .input("scanDate", sql.Date, scan.ScanDate)
      .query<{ ScanDate: Date; SecurityScore: number; RiskLevel: string }>(`
        SELECT TOP 1 ScanDate, SecurityScore, RiskLevel FROM WebsiteAuditScans
        WHERE WebsiteId = @websiteId AND ScanDate < @scanDate AND Status = 'Completed'
        ORDER BY ScanDate DESC
      `),
    db
      .request()
      .input("websiteId", sql.Int, scan.WebsiteId)
      .query<{ ScanDate: Date; SecurityScore: number | null; RiskLevel: string | null }>(`
        SELECT TOP 10 ScanDate, SecurityScore, RiskLevel FROM WebsiteAuditScans
        WHERE WebsiteId = @websiteId AND Status = 'Completed'
        ORDER BY ScanDate DESC
      `),
  ]);

  const findings = findingsResult.recordset as unknown as Finding[];
  const dependencyFindings = depResult.recordset as unknown as DependencyFinding[];
  const codeFindings = codeResult.recordset as unknown as CodeFinding[];
  const prevRow = prevResult.recordset[0];

  const previousScan: PreviousScanSummary | null = prevRow
    ? { scanDate: prevRow.ScanDate.toISOString().slice(0, 10), securityScore: prevRow.SecurityScore, riskLevel: prevRow.RiskLevel as RiskLevel }
    : null;

  const scanHistory: ScanHistoryPoint[] = historyResult.recordset
    .filter((r) => r.SecurityScore !== null)
    .map((r) => ({ scanDate: r.ScanDate.toISOString().slice(0, 10), securityScore: r.SecurityScore as number, riskLevel: (r.RiskLevel ?? "Low") as RiskLevel }))
    .reverse();

  return {
    scanId: scan.Id,
    websiteId: scan.WebsiteId,
    websiteName: scan.WebsiteName,
    websiteUrl: scan.WebsiteUrl,
    scanDate: scan.ScanDate.toISOString().slice(0, 10),
    status: scan.Status,
    detectedPlatform: scan.DetectedPlatform ?? "Other",
    securityScore: scan.SecurityScore ?? 0,
    riskLevel: (scan.RiskLevel ?? "Low") as RiskLevel,
    scanDurationMs: scan.ScanDurationMs,
    websiteStatus: scan.WebsiteStatus,
    hostingProvider: scan.HostingProvider,
    asn: scan.Asn,
    ipAddress: scan.IpAddress,
    ipv6Address: scan.Ipv6Address,
    moduleScores: computeModuleScores(findings, dependencyFindings, codeFindings),
    findings,
    dependencyFindings,
    codeFindings,
    recommendations: buildRecommendations(findings, dependencyFindings, codeFindings),
    remediationRoadmap: buildRemediationRoadmap(findings, dependencyFindings, codeFindings),
    previousScan,
    scanHistory,
  };
}
