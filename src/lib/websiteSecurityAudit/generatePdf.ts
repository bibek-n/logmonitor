import path from "path";
import fs from "fs/promises";
import PDFDocument from "pdfkit";
import { getDb, sql } from "@/lib/db";
import type { CodeFinding, DependencyFinding, Finding } from "./types";
import type { ScanDetail } from "./scanDetail";

// Stored outside any web-servable directory — same convention as screenshotStorage.ts —
// only reachable through the authenticated /api/admin/website-security/report/[scanId] route.
const REPORTS_ROOT = path.join(process.cwd(), "agent-storage", "website-audit-reports");
const CONTENT_WIDTH = 495; // A4 (595.28pt) minus 50pt margins each side, rounded down

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

function severityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "#b91c1c";
    case "high":
      return "#c2410c";
    case "medium":
      return "#a16207";
    case "low":
      return "#15803d";
    default:
      return "#6b7280";
  }
}

function scoreColor(score: number): string {
  if (score < 40) return "#b91c1c";
  if (score < 60) return "#c2410c";
  if (score < 80) return "#a16207";
  return "#15803d";
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "website";
}

export function auditPdfFilename(websiteName: string, scanDate: string): string {
  return `${slugify(websiteName)}-security-audit-${scanDate}.pdf`;
}

function sortBySeverity<T extends { severity: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
}

function findingsByCategory(findings: Finding[], categories: string[]): Finding[] {
  return sortBySeverity(findings.filter((f) => categories.includes(f.category)));
}

// Pure JS, no native bindings — consistent with this app's established avoidance of heavy
// or native dependencies on its Windows/iisnode host (the same reason nodemailer was
// avoided in favor of a hand-rolled raw-SMTP sender). Charts are hand-drawn with pdfkit's
// vector primitives below — no chart library, no native canvas dependency.
export async function generateAuditPdf(detail: ScanDetail): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true, autoFirstPage: false });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  let pageIndex = -1;
  doc.on("pageAdded", () => {
    pageIndex++;
  });

  const toc: { title: string; pageNumber: number }[] = [];

  function newSectionPage(title: string) {
    doc.addPage();
    toc.push({ title, pageNumber: pageIndex + 1 });
    doc.fontSize(16).fillColor("#000").text(title);
    doc.moveDown(0.5);
  }

  function subheading(title: string) {
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor("#000").text(title);
    doc.moveDown(0.2);
  }

  function bodyText(text: string, color = "#333") {
    doc.fontSize(9.5).fillColor(color).text(text);
  }

  function codeFindingList(items: CodeFinding[], emptyText: string) {
    if (items.length === 0) {
      bodyText(emptyText, "#555");
      return;
    }
    for (const f of items) {
      doc.fontSize(10).fillColor(severityColor(f.severity)).text(`[${f.severity.toUpperCase()}] ${f.category}${f.location ? ` — ${f.location}` : ""}`);
      doc.fillColor("#333").fontSize(9);
      doc.text(`Masked evidence: ${f.maskedEvidence}`);
      if (f.recommendation) doc.text(`Recommendation: ${f.recommendation}`);
      doc.moveDown(0.3);
    }
  }

  function dependencyFindingList(items: DependencyFinding[], emptyText: string) {
    if (items.length === 0) {
      bodyText(emptyText, "#555");
      return;
    }
    for (const f of items) {
      doc.fontSize(10).fillColor(severityColor(f.severity)).text(`[${f.severity.toUpperCase()}] ${f.packageName}@${f.currentVersion ?? "unknown"} (${f.ecosystem})`);
      doc.fillColor("#333").fontSize(9);
      doc.text(f.reason === "known_cve" ? `Known CVEs: ${f.cveIds}` : "Deprecated/unmaintained package");
      if (f.recommendedVersion) doc.text(`Recommended version: ${f.recommendedVersion}`);
      doc.moveDown(0.3);
    }
  }

  function findingList(items: Finding[], emptyText: string) {
    if (items.length === 0) {
      bodyText(emptyText, "#555");
      return;
    }
    for (const f of items) {
      doc.fontSize(10).fillColor(severityColor(f.severity)).text(`[${f.severity.toUpperCase()}] ${f.title}`);
      doc.fillColor("#333").fontSize(9);
      if (f.description) doc.text(f.description);
      if (f.evidence) doc.text(`Evidence: ${f.evidence}`);
      if (f.affectedUrl) doc.text(`Affected URL: ${f.affectedUrl}${f.parameter ? ` (parameter: ${f.parameter})` : ""}`);
      if (f.recommendation) doc.text(`Recommendation: ${f.recommendation}`);
      doc.moveDown(0.3);
    }
  }

  // --- Chart helpers (hand-drawn vector primitives) ---

  function drawHorizontalBar(label: string, value: number, color: string, suffix = "/100") {
    const barWidth = CONTENT_WIDTH - 160;
    const barHeight = 13;
    const startX = doc.page.margins.left + 160;
    const y = doc.y;
    doc.fontSize(9).fillColor("#333").text(label, doc.page.margins.left, y + 2, { width: 155 });
    doc.rect(startX, y, barWidth, barHeight).fillOpacity(0.15).fill("#9ca3af").fillOpacity(1);
    const w = Math.max(2, (Math.max(0, Math.min(100, value)) / 100) * barWidth);
    doc.rect(startX, y, w, barHeight).fill(color);
    doc.fontSize(9).fillColor("#000").text(`${value}${suffix}`, startX + barWidth + 6, y + 2);
    doc.y = y + barHeight + 8;
    doc.x = doc.page.margins.left;
  }

  function drawSeverityStackedBar(counts: Record<string, number>) {
    const order = ["critical", "high", "medium", "low", "info"];
    const total = order.reduce((sum, k) => sum + (counts[k] ?? 0), 0) || 1;
    const barWidth = CONTENT_WIDTH;
    const barHeight = 22;
    const startX = doc.page.margins.left;
    const y = doc.y;
    let x = startX;
    for (const sev of order) {
      const count = counts[sev] ?? 0;
      const w = (count / total) * barWidth;
      if (w > 0) {
        doc.rect(x, y, w, barHeight).fill(severityColor(sev));
        x += w;
      }
    }
    doc.y = y + barHeight + 8;
    doc.x = startX;
    doc.fontSize(9).fillColor("#333");
    const legend = order.map((sev) => `${sev}: ${counts[sev] ?? 0}`).join("   |   ");
    doc.text(legend, startX);
    doc.moveDown(0.5);
  }

  function drawTrendChart(history: ScanDetail["scanHistory"]) {
    if (history.length < 2) {
      bodyText("Not enough scan history yet to show a trend (need at least 2 completed scans).", "#555");
      return;
    }
    const chartWidth = CONTENT_WIDTH;
    const chartHeight = 110;
    const startX = doc.page.margins.left;
    const startY = doc.y;

    doc
      .moveTo(startX, startY)
      .lineTo(startX, startY + chartHeight)
      .lineTo(startX + chartWidth, startY + chartHeight)
      .strokeColor("#999999")
      .lineWidth(1)
      .stroke();

    const n = history.length;
    const stepX = chartWidth / (n - 1);
    const points = history.map((h, i) => ({
      x: startX + i * stepX,
      y: startY + chartHeight - (Math.max(0, Math.min(100, h.securityScore)) / 100) * chartHeight,
      score: h.securityScore,
      date: h.scanDate,
    }));

    doc.strokeColor("#2563eb").lineWidth(1.5);
    points.forEach((p, i) => {
      if (i === 0) doc.moveTo(p.x, p.y);
      else doc.lineTo(p.x, p.y);
    });
    doc.stroke();
    for (const p of points) doc.circle(p.x, p.y, 3).fill("#2563eb");

    doc.fontSize(7).fillColor("#555");
    const labelStep = Math.max(1, Math.floor(n / 6));
    points.forEach((p, i) => {
      if (i % labelStep === 0 || i === points.length - 1) {
        doc.text(p.date, p.x - 20, startY + chartHeight + 4, { width: 40, align: "center" });
      }
    });

    doc.y = startY + chartHeight + 20;
    doc.x = startX;
  }

  function drawComparisonBars(current: { label: string; score: number }, previous: { label: string; score: number } | null) {
    if (!previous) {
      bodyText("No prior completed scan on record for this website — comparison will be available starting with the next scan.", "#555");
      return;
    }
    drawHorizontalBar(previous.label, previous.score, scoreColor(previous.score));
    drawHorizontalBar(current.label, current.score, scoreColor(current.score));
    const delta = current.score - previous.score;
    const deltaText = delta > 0 ? `+${delta} (improved)` : delta < 0 ? `${delta} (declined)` : "no change";
    doc.moveDown(0.2);
    doc.fontSize(9.5).fillColor(delta >= 0 ? "#15803d" : "#b91c1c").text(`Change since previous scan: ${deltaText}`);
  }

  // =========================================================================
  // Cover page
  // =========================================================================
  doc.addPage();
  doc.fontSize(24).fillColor("#000").text("Website Security Audit Report", { align: "center" });
  doc.moveDown(2);
  doc.fontSize(14).fillColor("#333").text(detail.websiteName, { align: "center" });
  doc.fontSize(11).fillColor("#555").text(detail.websiteUrl, { align: "center" });
  doc.moveDown(1);
  doc.fontSize(10).fillColor("#555").text(`Scan date: ${detail.scanDate}`, { align: "center" });
  doc.fontSize(10).fillColor("#555").text(`Report generated: ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`, { align: "center" });
  doc.moveDown(3);
  doc.fontSize(28).fillColor(scoreColor(detail.securityScore)).text(`${detail.securityScore} / 100`, { align: "center" });
  doc.fontSize(13).fillColor(scoreColor(detail.securityScore)).text(`${detail.riskLevel} Risk`, { align: "center" });
  doc.moveDown(4);
  doc
    .fontSize(9)
    .fillColor("#777")
    .text(
      "Confidential — prepared for internal use. This report reflects safe, non-destructive, non-intrusive checks only. See the Scan Limitations and Disclaimer sections for methodology and scope.",
      { align: "center" }
    );

  // =========================================================================
  // Table of Contents (reserved blank now, filled in at the very end)
  // =========================================================================
  doc.addPage();
  const tocPageIndex = pageIndex;

  // =========================================================================
  // 3. Executive Summary
  // =========================================================================
  newSectionPage("Executive Summary");
  const allEnriched = [...detail.findings, ...detail.dependencyFindings, ...detail.codeFindings];
  const severityCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of allEnriched) severityCounts[f.severity] = (severityCounts[f.severity] ?? 0) + 1;

  bodyText(`Website: ${detail.websiteName} (${detail.websiteUrl})`);
  bodyText(`Scan date: ${detail.scanDate}${detail.scanDurationMs ? `  |  Duration: ${(detail.scanDurationMs / 1000).toFixed(1)}s` : ""}`);
  bodyText(`Website status: ${detail.websiteStatus ?? "Unknown"}`);
  bodyText(`Technology detected: ${detail.detectedPlatform}`);
  bodyText(`Web server / hosting: ${detail.hostingProvider ?? "Unknown"}${detail.asn ? ` (${detail.asn})` : ""}`);
  doc.moveDown(0.5);
  doc.fontSize(20).fillColor(scoreColor(detail.securityScore)).text(`Overall Security Score: ${detail.securityScore} / 100 — ${detail.riskLevel} Risk`);
  doc.moveDown(0.5);
  bodyText(
    `Total findings: ${allEnriched.length}  |  Critical: ${severityCounts.critical}  |  High: ${severityCounts.high}  |  Medium: ${severityCounts.medium}  |  Low: ${severityCounts.low}  |  Informational: ${severityCounts.info}`
  );
  doc.moveDown(0.5);
  subheading("Comparison with Previous Scan");
  drawComparisonBars(
    { label: `Current (${detail.scanDate})`, score: detail.securityScore },
    detail.previousScan ? { label: `Previous (${detail.previousScan.scanDate})`, score: detail.previousScan.securityScore } : null
  );

  doc.moveDown(0.5);
  subheading("Suggestions");
  if (detail.recommendations.length === 0) {
    bodyText("No specific suggestions — no material issues detected.", "#555");
  } else {
    doc.fontSize(9.5).fillColor("#333");
    for (const rec of detail.recommendations.slice(0, 10)) doc.text(`• ${rec}`);
    if (detail.recommendations.length > 10) {
      doc.fillColor("#555").text(`...and ${detail.recommendations.length - 10} more — see the Remediation Roadmap section for the full list.`);
    }
  }

  // =========================================================================
  // 4. Website Information
  // =========================================================================
  newSectionPage("Website Information");
  bodyText(`Domain: ${new URL(detail.websiteUrl).hostname}`);
  bodyText(`IPv4: ${detail.ipAddress ?? "unknown"}   |   IPv6: ${detail.ipv6Address ?? "none"}`);
  bodyText(`Hosting provider: ${detail.hostingProvider ?? "unknown"}   |   ASN: ${detail.asn ?? "unknown"}`);
  doc.moveDown(0.3);
  findingList(findingsByCategory(detail.findings, ["website_info_summary", "cdn_waf_detected", "hosting_info", "missing_security_txt", "dns_records_summary"]), "No additional website information findings.");

  // =========================================================================
  // 5. Technology Stack
  // =========================================================================
  newSectionPage("Technology Stack");
  findingList(
    findingsByCategory(detail.findings, [
      "tech_stack_summary",
      "outdated_js_library",
      "cms_version_disclosed",
      "cms_eol_version",
      "cms_plugins_detected",
      "cms_plugin_version_disclosed",
      "cms_theme_detected",
      "php_version_disclosed",
      "php_eol_version",
    ]),
    "No technology stack findings."
  );

  // =========================================================================
  // 6. SSL/TLS Report
  // =========================================================================
  newSectionPage("SSL/TLS Certificate Report");
  findingList(findingsByCategory(detail.findings, ["tls_summary", "weak_tls", "missing_https_redirect", "mixed_content"]), "No SSL/TLS findings.");

  // =========================================================================
  // 7. Header Analysis
  // =========================================================================
  newSectionPage("HTTP Header Analysis");
  findingList(findingsByCategory(detail.findings, ["http_headers_summary", "missing_headers", "cors_misconfiguration"]), "No header findings.");

  // =========================================================================
  // 8. Cookie Analysis
  // =========================================================================
  newSectionPage("Cookie Analysis");
  findingList(findingsByCategory(detail.findings, ["insecure_cookies", "auth_session_cookie_exposed"]), "No cookie issues found.");

  // =========================================================================
  // 9. Authentication Analysis
  // =========================================================================
  newSectionPage("Authentication Security");
  findingList(
    findingsByCategory(detail.findings, ["auth_login_page_detected", "auth_csrf_token_missing", "auth_no_mfa_indicator", "auth_no_logout_found", "auth_session_cookie_exposed"]),
    "No authentication-related findings — a login page may not have been discovered during this scan's limited crawl."
  );

  // =========================================================================
  // 10. OWASP Top 10 Assessment
  // =========================================================================
  newSectionPage("OWASP Top 10 Assessment");
  bodyText(
    "Every category below was evaluated. Categories marked Tentative and described as heuristic-only reflect this scanner's safe, non-destructive scope — they are not equivalent to authenticated or out-of-band-backed penetration testing.",
    "#555"
  );
  doc.moveDown(0.3);
  findingList(
    findingsByCategory(detail.findings, [
      "owasp_reflected_xss",
      "owasp_sql_injection_indicator",
      "owasp_open_redirect",
      "owasp_clickjacking",
      "owasp_dom_xss",
      "owasp_stored_xss_heuristic",
      "owasp_ssrf_heuristic",
      "owasp_xxe_heuristic",
      "owasp_command_injection_heuristic",
      "owasp_ssti_heuristic",
      "owasp_lfi_rfi_heuristic",
      "owasp_idor_heuristic",
      "owasp_broken_access_control_heuristic",
      "owasp_insecure_deserialization_heuristic",
      "owasp_prototype_pollution_heuristic",
      "open_redirect_risk",
    ]),
    "No OWASP findings recorded."
  );

  // =========================================================================
  // 11. Server Security
  // =========================================================================
  newSectionPage("Server Security");
  findingList(
    findingsByCategory(detail.findings, [
      "insecure_http_methods",
      "exposed_sensitive_files",
      "exposed_admin_api",
      "exposed_package_manifest",
      "debug_exposure",
      "cms_xmlrpc_exposed",
      "cms_user_enum",
      "php_version_disclosed",
      "php_eol_version",
    ]),
    "No server security findings."
  );

  // =========================================================================
  // 12. JavaScript Security
  // =========================================================================
  newSectionPage("JavaScript Security");
  subheading("Client/server-side code findings");
  findingList(
    findingsByCategory(detail.findings, ["hardcoded_secret", "dangerous_function", "outdated_js_library", "exposed_package_manifest"]),
    "No JavaScript security findings from page/header scanning."
  );
  subheading("Code findings (from supplied source snippet / client bundles)");
  codeFindingList(sortBySeverity(detail.codeFindings), "No source snippet was supplied for this scan, or no issues were found.");
  subheading("Package / Dependency Risks");
  dependencyFindingList(
    sortBySeverity(detail.dependencyFindings),
    "No dependency manifest was supplied or publicly exposed for this scan, or no known issues were found."
  );

  // =========================================================================
  // 13. DNS Security
  // =========================================================================
  newSectionPage("DNS Security");
  findingList(findingsByCategory(detail.findings, ["dns_records_summary", "dns_missing_caa", "dns_no_dnssec"]), "No DNS findings.");

  // =========================================================================
  // 14. Email Security
  // =========================================================================
  newSectionPage("Email Security (SPF / DKIM / DMARC / BIMI)");
  findingList(
    findingsByCategory(detail.findings, ["email_records_summary", "email_spf_missing", "email_dkim_missing", "email_dmarc_missing", "email_dmarc_weak_policy", "email_bimi_missing"]),
    "No email security findings."
  );

  // =========================================================================
  // 15. Performance
  // =========================================================================
  newSectionPage("Performance");
  findingList(findingsByCategory(detail.findings, ["performance_summary", "performance_slow_ttfb", "performance_no_compression"]), "No performance findings.");

  // =========================================================================
  // 16. Vulnerability Details (full enriched list)
  // =========================================================================
  newSectionPage("Vulnerability Details");
  const actionableFindings = sortBySeverity(detail.findings.filter((f) => f.severity !== "info"));
  if (actionableFindings.length === 0) {
    bodyText("No actionable (non-informational) findings were recorded for this scan.", "#555");
  }
  for (const f of actionableFindings) {
    doc.fontSize(11).fillColor(severityColor(f.severity)).text(`[${f.severity.toUpperCase()}] ${f.title}`);
    doc.fontSize(8.5).fillColor("#333");
    if (f.cvss !== undefined) doc.text(`CVSS v3.1: ${f.cvss}   |   CWE: ${f.cwe ?? "N/A"}   |   OWASP: ${f.owaspCategory ?? "N/A"}   |   Confidence: ${f.confidence ?? "N/A"}`);
    if (f.affectedUrl) doc.text(`Affected URL: ${f.affectedUrl}${f.parameter ? `   Parameter: ${f.parameter}` : ""}${f.httpMethod ? `   Method: ${f.httpMethod}` : ""}`);
    if (f.description) doc.text(`Description: ${f.description}`);
    if (f.evidence) doc.text(`Evidence: ${f.evidence}`);
    if (f.businessImpact) doc.text(`Business impact: ${f.businessImpact}`);
    if (f.attackScenario && f.attackScenario !== "N/A") doc.text(`Attack scenario: ${f.attackScenario}`);
    if (f.recommendation) doc.text(`Remediation: ${f.recommendation}`);
    if (f.verificationSteps) doc.text(`Verification steps: ${f.verificationSteps}`);
    if (f.references && f.references.length > 0) doc.text(`References: ${f.references.join("  |  ")}`);
    doc.moveDown(0.5);
  }

  // =========================================================================
  // 17. Risk Matrix
  // =========================================================================
  newSectionPage("Risk Matrix");
  drawSeverityStackedBar(severityCounts);
  doc.moveDown(1);
  bodyText(
    `Critical: ${severityCounts.critical} — fix immediately.  High: ${severityCounts.high} — fix within 7 days.  Medium: ${severityCounts.medium} — fix within 30 days.  Low: ${severityCounts.low} — best practice.  Informational: ${severityCounts.info} — no action required.`
  );

  // =========================================================================
  // 18. Security Score (overall + module breakdown)
  // =========================================================================
  newSectionPage("Security Score");
  drawHorizontalBar("Overall", detail.securityScore, scoreColor(detail.securityScore));
  doc.moveDown(0.5);
  subheading("Module breakdown");
  const moduleLabels: [keyof typeof detail.moduleScores, string][] = [
    ["headers", "HTTP Headers"],
    ["ssl", "SSL/TLS"],
    ["auth", "Authentication"],
    ["cookies", "Cookies"],
    ["js", "JavaScript / Dependencies"],
    ["dns", "DNS"],
    ["email", "Email Security"],
    ["server", "Server Security"],
    ["owasp", "OWASP Top 10"],
    ["performance", "Performance"],
  ];
  for (const [key, label] of moduleLabels) {
    drawHorizontalBar(label, detail.moduleScores[key], scoreColor(detail.moduleScores[key]));
  }

  // =========================================================================
  // 19. Charts
  // =========================================================================
  newSectionPage("Charts");
  subheading("Severity Distribution");
  drawSeverityStackedBar(severityCounts);
  doc.moveDown(1);
  subheading("Security Score Gauge");
  drawHorizontalBar("Overall Score", detail.securityScore, scoreColor(detail.securityScore));
  doc.moveDown(1);
  subheading("Vulnerability / Score Trend (recent scans)");
  drawTrendChart(detail.scanHistory);
  doc.moveDown(1);
  subheading("Compliance / Module Overview");
  for (const [key, label] of moduleLabels) {
    drawHorizontalBar(label, detail.moduleScores[key], scoreColor(detail.moduleScores[key]));
  }

  // =========================================================================
  // 20. Remediation Roadmap
  // =========================================================================
  newSectionPage("Remediation Roadmap");
  const roadmapSections: [string, string[]][] = [
    ["Immediate (Critical)", detail.remediationRoadmap.immediate],
    ["Within 7 Days (High)", detail.remediationRoadmap.within7Days],
    ["Within 30 Days (Medium)", detail.remediationRoadmap.within30Days],
    ["Best Practice (Low)", detail.remediationRoadmap.bestPractice],
    ["Informational", detail.remediationRoadmap.informational],
  ];
  for (const [label, items] of roadmapSections) {
    subheading(label);
    if (items.length === 0) {
      bodyText("Nothing in this bucket.", "#555");
    } else {
      doc.fontSize(9).fillColor("#333");
      for (const item of items) doc.text(`• ${item}`);
    }
  }

  // =========================================================================
  // 21. Appendix + Disclaimer
  // =========================================================================
  newSectionPage("Appendix");
  bodyText(
    "Methodology: this report was produced by an automated scanner performing safe, non-destructive, non-intrusive checks against the target website — HTTP/TLS/DNS/email inspection, response-header analysis, and a small set of benign active probes (reflected-value checks, redirect-header inspection, single-character syntax probes) confined to observing server responses. No brute-force, password, denial-of-service, or destructive testing was performed, and no exploitation was attempted."
  );
  doc.moveDown(0.5);
  bodyText(
    `Scope: this scan covered ${detail.websiteUrl} and a small number of same-origin pages discovered during a bounded crawl. Package/dependency and source-code checks only ran if a lockfile or source snippet had been supplied for this website ahead of time.`
  );
  doc.moveDown(0.5);
  bodyText(
    "Tools/techniques: built-in Node.js fetch/tls/dns APIs, this application's own regex-based heuristics, the free OSV.dev vulnerability database (when a lockfile was supplied), and a free public IP-information lookup for hosting/ASN data."
  );

  newSectionPage("Scan Limitations and Disclaimer");
  doc
    .fontSize(9.5)
    .fillColor("#333")
    .text(
      "This report is generated from safe, non-destructive, non-intrusive checks only. No brute-force attacks, password attacks, denial-of-service tests, destructive exploitation, or unauthorized scanning were performed at any point.\n\n" +
        "Reflected-XSS and open-redirect findings marked Firm/Confirmed are based on directly observing the server's own response to a single benign, non-executing test value — never an executed payload. SQL-injection indicators are based on an observed error-message signature only and require manual confirmation.\n\n" +
        "The following OWASP categories are heuristic-only in this scanner and require authenticated access and/or out-of-band callback infrastructure (e.g. Burp Collaborator) to confirm with certainty: SSRF, XXE, Command Injection, SSTI, LFI/RFI, IDOR, Broken Access Control, Insecure Deserialization, Stored XSS, and Prototype Pollution. Every one of these categories is reported explicitly above — either with an observed indicator for manual review, or an honest 'no indicators observed' result — never silently omitted, and never presented as confirmed.\n\n" +
        "Package/dependency and source-code checks reflect only the lockfile/snippet data made available for this website at scan time and may be incomplete. CVSS scores shown come from a fixed per-category reference table (industry-typical severity for that vulnerability class), not a dynamic per-instance calculation.\n\n" +
        "This report is not a substitute for a certified penetration test. This scan was performed by an authorized administrator of this website's owning organization for internal security monitoring purposes only."
    );

  // =========================================================================
  // Finalize: go back and fill in the Table of Contents now that every
  // section's page number is known.
  // =========================================================================
  doc.switchToPage(tocPageIndex);
  doc.x = doc.page.margins.left;
  doc.y = doc.page.margins.top;
  doc.fontSize(18).fillColor("#000").text("Table of Contents");
  doc.moveDown(1);
  doc.fontSize(10).fillColor("#333");
  for (const entry of toc) {
    doc.text(`${entry.title}  ${".".repeat(Math.max(2, 60 - entry.title.length))}  p.${entry.pageNumber}`);
  }

  doc.end();
  return done;
}

export async function saveAuditPdf(buffer: Buffer, filename: string): Promise<string> {
  await fs.mkdir(REPORTS_ROOT, { recursive: true });
  const filePath = path.join(REPORTS_ROOT, filename);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function readAuditPdf(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath);
}

export async function deleteAuditPdf(filePath: string): Promise<void> {
  await fs.rm(filePath, { force: true });
}

// Shared by the report download/view route and the post-scan email sender — a PDF is
// generated once per scan and reused (WebsiteAuditReports), regardless of which caller
// asks for it first.
export async function getOrGenerateAuditPdf(scanId: number, detail: ScanDetail): Promise<{ buffer: Buffer; filename: string }> {
  const db = await getDb();
  const existing = await db.request().input("scanId", sql.Int, scanId).query<{ PdfPath: string }>(
    "SELECT PdfPath FROM WebsiteAuditReports WHERE ScanId = @scanId"
  );
  const filename = auditPdfFilename(detail.websiteName, detail.scanDate);
  if (existing.recordset[0]) {
    return { buffer: await readAuditPdf(existing.recordset[0].PdfPath), filename };
  }
  const buffer = await generateAuditPdf(detail);
  const filePath = await saveAuditPdf(buffer, filename);
  await db
    .request()
    .input("scanId", sql.Int, scanId)
    .input("pdfPath", sql.NVarChar, filePath)
    .query("INSERT INTO WebsiteAuditReports (ScanId, PdfPath) VALUES (@scanId, @pdfPath)");
  return { buffer, filename };
}

// Re-exported so callers that only need finding-shape helpers don't need a separate import.
export type { Finding, DependencyFinding, CodeFinding };
