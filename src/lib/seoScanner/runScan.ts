import { fetchPage } from "./fetchPage";
import {
  checkBrokenLinks,
  checkCanonicalUrl,
  checkImageAlt,
  checkMetaTags,
  checkOpenGraph,
  checkRobotsTxt,
  checkSitemapXml,
  checkStructuredData,
  checkTwitterCards,
} from "./checks";
import { CHECK_LABELS, type CheckId, type CheckSummary, type ScanFinding, type SeoScanReport } from "./shared";

// Score is the proportion of the 9 checks that came back clean, same shape as Security
// Headers' computeGrade (proportion-of-checks-passed -> 0-100 score -> letter grade) rather
// than WordPress Scan's worst-severity-wins riskLevel - a report card, not a risk verdict.
function computeScore(checks: CheckSummary[]): { score: number; grade: string } {
  const total = checks.length || 1;
  const ok = checks.filter((c) => c.status === "ok").length;
  const score = Math.round((ok / total) * 100);
  let grade: string;
  if (score >= 90) grade = "A";
  else if (score >= 75) grade = "B";
  else if (score >= 60) grade = "C";
  else if (score >= 40) grade = "D";
  else grade = "F";
  return { score, grade };
}

// Drives every check for one scan. Each check is isolated by runCheck so one failing check
// (e.g. a network blip probing broken links) can't blank out the other 8 results - same
// resilience pattern as WordPress Scan's runWordPressDeepScan.
export async function runSeoScan(inputUrl: string): Promise<SeoScanReport> {
  const page = await fetchPage(inputUrl);
  const baseUrl = page.finalUrl;

  const findings: ScanFinding[] = [];
  const checks: CheckSummary[] = [];

  async function runCheck(id: CheckId, fn: () => Promise<ScanFinding[]> | ScanFinding[]): Promise<void> {
    const label = CHECK_LABELS[id];
    try {
      const results = await fn();
      findings.push(...results);
      checks.push({ check: id, label, status: results.length ? "issues_found" : "ok", findingCount: results.length });
    } catch {
      checks.push({ check: id, label, status: "error", findingCount: 0 });
    }
  }

  await runCheck("robots_txt", () => checkRobotsTxt(baseUrl));
  await runCheck("sitemap_xml", () => checkSitemapXml(baseUrl));
  await runCheck("meta_tags", () => checkMetaTags(page.html));
  await runCheck("canonical_url", () => checkCanonicalUrl(page.html, baseUrl));
  await runCheck("broken_links", () => checkBrokenLinks(page.html, baseUrl));
  await runCheck("image_alt", () => checkImageAlt(page.html));
  await runCheck("open_graph", () => checkOpenGraph(page.html));
  await runCheck("twitter_cards", () => checkTwitterCards(page.html));
  await runCheck("structured_data", () => checkStructuredData(page.html));

  const { score, grade } = computeScore(checks);

  return { targetUrl: baseUrl, score, grade, findings, checks, scannedAt: new Date().toISOString() };
}
