import tls from "tls";
import { getDb, sql } from "@/lib/db";
import { detectPlatform, detectTechSignals, detectVulnerableJsLibraries, checkPhpVersion } from "./platformDetect";
import { runHttpChecks } from "./httpChecks";
import { runDependencyChecks, detectExposedManifest } from "./dependencyChecks";
import { scanSourceForSecrets, scanClientBundlesForSecrets } from "./codeChecks";
import { computeSecurityScore, riskLevelForScore, buildRecommendations, computeModuleScores, buildRemediationRoadmap } from "./scoring";
import { lookupCatalog } from "./findingCatalog";
import { gatherWebsiteInfo, type WebsiteInfo } from "./websiteInfoChecks";
import { runDnsChecks } from "./dnsChecks";
import { runEmailSecurityChecks } from "./emailSecurityChecks";
import { runPerformanceChecks } from "./performanceChecks";
import { runWordPressChecks } from "./cmsChecks";
import { runOwaspActiveChecks } from "./owaspActiveChecks";
import type { CodeFinding, DependencyFinding, EnterpriseFindingFields, Finding } from "./types";

interface TlsCheckResult {
  findings: Finding[];
  supportedVersions: string[];
  sanList: string[];
  isWildcard: boolean;
  isSelfSigned: boolean;
  hasForwardSecrecy: boolean | null;
}

const EMPTY_TLS_RESULT: TlsCheckResult = { findings: [], supportedVersions: [], sanList: [], isWildcard: false, isSelfSigned: false, hasForwardSecrecy: null };

function attemptTlsVersion(host: string, port: number, version: "TLSv1" | "TLSv1.1" | "TLSv1.2" | "TLSv1.3"): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const socket = tls.connect({ host, port, servername: host, minVersion: version, maxVersion: version, rejectUnauthorized: false, timeout: 6000 }, () => {
      socket.end();
      resolvePromise(true);
    });
    socket.on("error", () => resolvePromise(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolvePromise(false);
    });
  });
}

// Expanded from v1: SAN list, wildcard/self-signed detection, forward-secrecy (via
// negotiated cipher name), and explicit per-version connection attempts (Node's tls.connect
// pinned to minVersion===maxVersion per attempt) rather than only reading back whatever
// version the default handshake happened to negotiate.
function checkTls(inputUrl: string): Promise<TlsCheckResult> {
  return new Promise((resolvePromise) => {
    let host: string;
    let port: number;
    try {
      const u = new URL(inputUrl);
      if (u.protocol !== "https:") return resolvePromise(EMPTY_TLS_RESULT);
      host = u.hostname;
      port = u.port ? Number(u.port) : 443;
    } catch {
      return resolvePromise(EMPTY_TLS_RESULT);
    }

    const findings: Finding[] = [];
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false, timeout: 10000 }, async () => {
      const cert = socket.getPeerCertificate();
      const protocol = socket.getProtocol();
      const cipher = socket.getCipher();
      const hasForwardSecrecy = cipher?.name ? /ECDHE|DHE/i.test(cipher.name) : null;

      if (protocol && ["TLSv1", "TLSv1.1", "SSLv3"].includes(protocol)) {
        findings.push({ category: "weak_tls", severity: "high", title: `Weak TLS protocol in use: ${protocol}`, recommendation: "Disable TLS 1.0/1.1 and SSLv3; require TLS 1.2 or newer." });
      }
      if (hasForwardSecrecy === false) {
        findings.push({
          category: "weak_tls",
          severity: "medium",
          title: `Negotiated cipher does not provide forward secrecy: ${cipher?.name ?? "unknown"}`,
          recommendation: "Configure the server to prefer ECDHE/DHE cipher suites for forward secrecy.",
        });
      }

      const isSelfSigned = !!cert && !!cert.issuer && !!cert.subject && JSON.stringify(cert.issuer) === JSON.stringify(cert.subject);
      if (isSelfSigned) {
        findings.push({ category: "weak_tls", severity: "high", title: "Certificate is self-signed", recommendation: "Use a certificate signed by a publicly trusted CA." });
      }
      if (!socket.authorized && !isSelfSigned) {
        findings.push({
          category: "weak_tls",
          severity: "high",
          title: "Certificate chain is not trusted",
          evidence: socket.authorizationError ? String(socket.authorizationError) : undefined,
          recommendation: "Use a certificate signed by a publicly trusted CA (or fix chain/intermediate configuration).",
        });
      }

      const sanRaw = cert?.subjectaltname;
      const sanList = sanRaw ? sanRaw.split(",").map((s) => s.trim().replace(/^DNS:/, "")) : [];
      const cnRaw = cert?.subject?.CN;
      const cn = Array.isArray(cnRaw) ? cnRaw[0] : cnRaw;
      const isWildcard = (cn?.startsWith("*.") ?? false) || sanList.some((s) => s.startsWith("*."));

      if (cert && cert.valid_to) {
        const daysLeft = Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86400000);
        if (daysLeft < 0) {
          findings.push({ category: "weak_tls", severity: "critical", title: "TLS certificate has expired", recommendation: "Renew the certificate immediately." });
        } else if (daysLeft <= 30) {
          findings.push({
            category: "weak_tls",
            severity: daysLeft <= 7 ? "high" : "medium",
            title: `TLS certificate expires in ${daysLeft} day(s)`,
            recommendation: "Renew the certificate before it expires.",
          });
        }
      }

      socket.end();

      const versionsToTest: ("TLSv1" | "TLSv1.1" | "TLSv1.2" | "TLSv1.3")[] = ["TLSv1", "TLSv1.1", "TLSv1.2", "TLSv1.3"];
      const results = await Promise.all(versionsToTest.map((v) => attemptTlsVersion(host, port, v)));
      const supportedVersions = versionsToTest.filter((_, i) => results[i]);

      resolvePromise({ findings, supportedVersions, sanList, isWildcard, isSelfSigned, hasForwardSecrecy });
    });
    socket.on("error", () => resolvePromise(EMPTY_TLS_RESULT));
    socket.on("timeout", () => {
      socket.destroy();
      resolvePromise(EMPTY_TLS_RESULT);
    });
  });
}

// Fills CVSS/CWE/OWASP-category/confidence/business-impact/attack-scenario/verification/
// references from the static catalog onto every finding before it's persisted — only where
// the finding didn't already set that field itself (owaspActiveChecks.ts sets its own
// confidence per-instance for the active probes, for example).
function mergeCatalogMetadata<T extends { category: string } & EnterpriseFindingFields>(finding: T): T {
  const entry = lookupCatalog(finding.category);
  if (!entry) return finding;
  return {
    ...finding,
    cvss: finding.cvss ?? entry.cvss,
    cwe: finding.cwe ?? entry.cwe,
    owaspCategory: finding.owaspCategory ?? entry.owaspCategory,
    confidence: finding.confidence ?? entry.defaultConfidence,
    module: finding.module ?? entry.module,
    businessImpact: finding.businessImpact ?? entry.businessImpact,
    attackScenario: finding.attackScenario ?? entry.attackScenario,
    verificationSteps: finding.verificationSteps ?? entry.verificationSteps,
    references: finding.references ?? entry.references,
  };
}

// DependencyFinding has no `category` field (it uses `reason` instead), so it can't go
// through mergeCatalogMetadata's generic — this looks the catalog up by a synthetic key
// derived from `reason`.
function mergeDependencyCatalog(finding: DependencyFinding): DependencyFinding {
  const syntheticCategory = finding.reason === "known_cve" ? "dependency_known_cve" : "dependency_deprecated_or_abandoned";
  const entry = lookupCatalog(syntheticCategory);
  if (!entry) return finding;
  return {
    ...finding,
    cvss: finding.cvss ?? entry.cvss,
    cwe: finding.cwe ?? entry.cwe,
    owaspCategory: finding.owaspCategory ?? entry.owaspCategory,
    confidence: finding.confidence ?? entry.defaultConfidence,
    module: finding.module ?? entry.module,
    businessImpact: finding.businessImpact ?? entry.businessImpact,
    attackScenario: finding.attackScenario ?? entry.attackScenario,
    verificationSteps: finding.verificationSteps ?? entry.verificationSteps,
    references: finding.references ?? entry.references,
  };
}

export interface RunScanOptions {
  websiteId: number;
  url: string;
  triggeredByUserId: number | null;
  triggeredBy: string;
}

export interface ScanSummary {
  scanId: number;
  detectedPlatform: string;
  securityScore: number;
  riskLevel: string;
  findingCount: number;
  dependencyFindingCount: number;
  codeFindingCount: number;
}

// Best-effort — a broken progress log must never take down the scan itself.
async function logProgress(scanId: number, message: string): Promise<void> {
  try {
    const db = await getDb();
    await db.request().input("scanId", sql.Int, scanId).input("message", sql.NVarChar, message).query(
      "INSERT INTO WebsiteAuditScanLog (ScanId, Message) VALUES (@scanId, @message)"
    );
  } catch (err) {
    console.error("[runScan] failed to write progress log line:", err instanceof Error ? err.message : err);
  }
}

// Creates the 'Running' scan row and returns its id immediately, before any of the slow
// checks run — the manual-scan API route uses this to respond to the browser right away
// instead of blocking on the full scan (which can legitimately take a minute or more with
// the OWASP crawler, WordPress plugin enumeration, and per-TLS-version probes all added
// since v1), then lets executeScan() continue in the background.
export async function createScanRow(opts: RunScanOptions): Promise<number> {
  const db = await getDb();
  const insertResult = await db
    .request()
    .input("websiteId", sql.Int, opts.websiteId)
    .input("triggeredByUserId", sql.Int, opts.triggeredByUserId)
    .input("triggeredBy", sql.NVarChar, opts.triggeredBy)
    .query<{ Id: number }>(`
      INSERT INTO WebsiteAuditScans (WebsiteId, ScanDate, Status, TriggeredByUserId, TriggeredBy)
      OUTPUT INSERTED.Id
      VALUES (@websiteId, CAST(SYSUTCDATETIME() AS DATE), 'Running', @triggeredByUserId, @triggeredBy)
    `);
  return insertResult.recordset[0].Id;
}

async function executeScanInner(scanId: number, opts: RunScanOptions): Promise<ScanSummary> {
  const db = await getDb();
  const scanStart = Date.now();

  let findings: Finding[] = [];
  let dependencyFindings: DependencyFinding[] = [];
  let codeFindings: CodeFinding[] = [];
  let detectedPlatform = "Other";
  let websiteStatus = "Unreachable";
  let websiteInfo: WebsiteInfo | null = null;

  try {
    await logProgress(scanId, `Connecting to ${opts.url} and checking HTTP headers, cookies, CORS, methods...`);
    const { findings: httpFindings, context } = await runHttpChecks(opts.url);
    findings = httpFindings;
    websiteStatus = "Online";
    detectedPlatform = await detectPlatform(context.html, context.headers);
    await logProgress(scanId, `Detected platform: ${detectedPlatform}. Running TLS, DNS, email, website-info, and performance checks in parallel...`);

    const domain = new URL(opts.url).hostname;

    const [tlsResult, infoResult, dnsResult, emailResult, perfResult] = await Promise.all([
      checkTls(opts.url),
      gatherWebsiteInfo(opts.url, context.headers),
      runDnsChecks(domain),
      runEmailSecurityChecks(domain),
      runPerformanceChecks(opts.url),
    ]);

    findings.push(...tlsResult.findings, ...infoResult.findings, ...dnsResult.findings, ...emailResult.findings, ...perfResult.findings);
    websiteInfo = infoResult.info;
    await logProgress(scanId, "TLS/DNS/email/performance checks complete.");

    findings.push({
      category: "http_headers_summary",
      severity: "info",
      title: "Extended header values",
      description: `COOP: ${context.extendedHeaders.crossOriginOpenerPolicy ?? "(not set)"} | COEP: ${context.extendedHeaders.crossOriginEmbedderPolicy ?? "(not set)"} | CORP: ${
        context.extendedHeaders.crossOriginResourcePolicy ?? "(not set)"
      } | Expect-CT: ${context.extendedHeaders.expectCt ?? "(not set)"} | Cache-Control: ${context.extendedHeaders.cacheControl ?? "(not set)"} | Server: ${
        context.extendedHeaders.server ?? "(not disclosed)"
      } | X-Powered-By: ${context.extendedHeaders.poweredBy ?? "(not disclosed)"}`,
    });

    if (opts.url.startsWith("https://")) {
      findings.push({
        category: "tls_summary",
        severity: "info",
        title: "TLS configuration summary",
        description: `Supported versions: ${tlsResult.supportedVersions.join(", ") || "none confirmed"} | Forward secrecy: ${
          tlsResult.hasForwardSecrecy === null ? "unknown" : tlsResult.hasForwardSecrecy ? "yes" : "no"
        } | Wildcard certificate: ${tlsResult.isWildcard ? "yes" : "no"} | Self-signed: ${tlsResult.isSelfSigned ? "yes" : "no"} | SAN entries: ${
          tlsResult.sanList.length
        }`,
        evidence: tlsResult.sanList.slice(0, 10).join(", "),
      });
    }

    const techSignals = detectTechSignals(context.html);
    findings.push({
      category: "tech_stack_summary",
      severity: "info",
      title: "Technology stack signals",
      description: `Platform: ${detectedPlatform} | Analytics: ${techSignals.analytics.join(", ") || "none detected"} | Tag manager: ${
        techSignals.tagManager.join(", ") || "none detected"
      }${techSignals.theme ? ` | Theme: ${techSignals.theme}` : ""}`,
    });

    if (detectedPlatform === "WordPress") {
      await logProgress(scanId, "WordPress detected — enumerating plugins, theme, and core version (this can take a little while)...");
      findings.push(...(await runWordPressChecks(opts.url, context.html)));
      await logProgress(scanId, "WordPress checks complete.");
    }

    findings.push(...detectVulnerableJsLibraries(context.html));
    findings.push(...checkPhpVersion(context.headers));

    await logProgress(scanId, "Scanning client-side JS bundles for exposed secrets...");
    codeFindings.push(...(await scanClientBundlesForSecrets(opts.url, context.html)));

    await logProgress(scanId, "Running OWASP checks (crawling same-origin pages, safe active probes)...");
    const owaspResult = await runOwaspActiveChecks(opts.url, context.html, findings, codeFindings);
    findings.push(...owaspResult.findings);
    await logProgress(scanId, `OWASP checks complete (visited ${owaspResult.pagesVisited} page(s), ${owaspResult.requestsMade} request(s)).`);

    const sourceInput = await db
      .request()
      .input("websiteId", sql.Int, opts.websiteId)
      .query<{ Ecosystem: string | null; LockfileFilename: string | null; LockfileContent: string | null; SourceSnippet: string | null }>(
        `SELECT Ecosystem, LockfileFilename, LockfileContent, SourceSnippet FROM WebsiteAuditSourceInputs WHERE WebsiteId = @websiteId`
      );
    const source = sourceInput.recordset[0];
    if (source?.LockfileContent && source.LockfileFilename) {
      await logProgress(scanId, "Checking supplied dependency manifest for known CVEs...");
      dependencyFindings = await runDependencyChecks(source.LockfileFilename, source.LockfileContent);
    } else {
      // No admin-provided lockfile — check whether the site accidentally serves one
      // publicly (package.json, composer.lock, etc.) and use it automatically if so.
      await logProgress(scanId, "Checking for publicly exposed dependency manifests...");
      const exposed = await detectExposedManifest(opts.url);
      if (exposed) {
        findings.push({
          category: "exposed_package_manifest",
          severity: "medium",
          title: `Dependency manifest publicly exposed: /${exposed.filename}`,
          recommendation: "Remove or block public access to dependency manifest/lockfiles — they reveal your exact technology stack and versions.",
        });
        dependencyFindings = await runDependencyChecks(exposed.filename, exposed.content);
      }
    }
    if (source?.SourceSnippet) {
      codeFindings.push(...scanSourceForSecrets(source.SourceSnippet, "pasted-source-snippet"));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during scan";
    findings.push({ category: "scan_error", severity: "info", title: "Some checks could not complete", description: message });
    await logProgress(scanId, `Some checks could not complete: ${message}`);
  }

  await logProgress(scanId, "Computing security score and saving results...");

  findings = findings.map(mergeCatalogMetadata);
  dependencyFindings = dependencyFindings.map(mergeDependencyCatalog);
  codeFindings = codeFindings.map(mergeCatalogMetadata);

  const securityScore = computeSecurityScore(findings, dependencyFindings, codeFindings);
  const riskLevel = riskLevelForScore(securityScore);
  const moduleScores = computeModuleScores(findings, dependencyFindings, codeFindings);
  const scanDurationMs = Date.now() - scanStart;

  // Each insert is isolated — one malformed/oversized finding shouldn't abort the whole scan
  // and leave it stuck in 'Running' forever (seen live: an overlong MaskedEvidence value
  // threw and the scan never reached the 'Completed' update below).
  for (const f of findings) {
    try {
      await db
        .request()
        .input("scanId", sql.Int, scanId)
        .input("category", sql.NVarChar, f.category)
        .input("severity", sql.NVarChar, f.severity)
        .input("title", sql.NVarChar, f.title)
        .input("description", sql.NVarChar, f.description ?? null)
        .input("evidence", sql.NVarChar, f.evidence ?? null)
        .input("recommendation", sql.NVarChar, f.recommendation ?? null)
        .input("cvss", sql.Float, f.cvss ?? null)
        .input("cwe", sql.NVarChar, f.cwe ?? null)
        .input("owaspCategory", sql.NVarChar, f.owaspCategory ?? null)
        .input("confidence", sql.NVarChar, f.confidence ?? null)
        .input("affectedUrl", sql.NVarChar, f.affectedUrl ?? null)
        .input("parameter", sql.NVarChar, f.parameter ?? null)
        .input("httpMethod", sql.NVarChar, f.httpMethod ?? null)
        .input("module", sql.NVarChar, f.module ?? null)
        .input("httpRequestSnippet", sql.NVarChar, f.httpRequestSnippet ?? null)
        .input("httpResponseSnippet", sql.NVarChar, f.httpResponseSnippet ?? null)
        .query(
          `INSERT INTO WebsiteAuditFindings (ScanId, Category, Severity, Title, Description, Evidence, Recommendation, Cvss, Cwe, OwaspCategory, Confidence, AffectedUrl, Parameter, HttpMethod, Module, HttpRequestSnippet, HttpResponseSnippet)
           VALUES (@scanId, @category, @severity, @title, @description, @evidence, @recommendation, @cvss, @cwe, @owaspCategory, @confidence, @affectedUrl, @parameter, @httpMethod, @module, @httpRequestSnippet, @httpResponseSnippet)`
        );
    } catch (err) {
      console.error("[runScan] failed to persist a finding, skipping it:", err instanceof Error ? err.message : err);
    }
  }

  for (const f of dependencyFindings) {
    try {
      await db
        .request()
        .input("scanId", sql.Int, scanId)
        .input("packageName", sql.NVarChar, f.packageName)
        .input("currentVersion", sql.NVarChar, f.currentVersion)
        .input("recommendedVersion", sql.NVarChar, f.recommendedVersion)
        .input("ecosystem", sql.NVarChar, f.ecosystem)
        .input("severity", sql.NVarChar, f.severity)
        .input("cveIds", sql.NVarChar, f.cveIds)
        .input("reason", sql.NVarChar, f.reason)
        .input("cvss", sql.Float, f.cvss ?? null)
        .input("cwe", sql.NVarChar, f.cwe ?? null)
        .input("owaspCategory", sql.NVarChar, f.owaspCategory ?? null)
        .input("confidence", sql.NVarChar, f.confidence ?? null)
        .input("module", sql.NVarChar, f.module ?? null)
        .query(
          `INSERT INTO WebsiteDependencyFindings (ScanId, PackageName, CurrentVersion, RecommendedVersion, Ecosystem, Severity, CveIds, Reason, Cvss, Cwe, OwaspCategory, Confidence, Module)
           VALUES (@scanId, @packageName, @currentVersion, @recommendedVersion, @ecosystem, @severity, @cveIds, @reason, @cvss, @cwe, @owaspCategory, @confidence, @module)`
        );
    } catch (err) {
      console.error("[runScan] failed to persist a dependency finding, skipping it:", err instanceof Error ? err.message : err);
    }
  }

  for (const f of codeFindings) {
    try {
      await db
        .request()
        .input("scanId", sql.Int, scanId)
        .input("category", sql.NVarChar, f.category)
        .input("severity", sql.NVarChar, f.severity)
        .input("location", sql.NVarChar, f.location)
        .input("maskedEvidence", sql.NVarChar, f.maskedEvidence)
        .input("recommendation", sql.NVarChar, f.recommendation)
        .input("cvss", sql.Float, f.cvss ?? null)
        .input("cwe", sql.NVarChar, f.cwe ?? null)
        .input("owaspCategory", sql.NVarChar, f.owaspCategory ?? null)
        .input("confidence", sql.NVarChar, f.confidence ?? null)
        .input("module", sql.NVarChar, f.module ?? null)
        .query(
          `INSERT INTO WebsiteCodeFindings (ScanId, Category, Severity, Location, MaskedEvidence, Recommendation, Cvss, Cwe, OwaspCategory, Confidence, Module)
           VALUES (@scanId, @category, @severity, @location, @maskedEvidence, @recommendation, @cvss, @cwe, @owaspCategory, @confidence, @module)`
        );
    } catch (err) {
      console.error("[runScan] failed to persist a code finding, skipping it:", err instanceof Error ? err.message : err);
    }
  }

  await db
    .request()
    .input("scanId", sql.Int, scanId)
    .input("score", sql.Int, securityScore)
    .input("risk", sql.NVarChar, riskLevel)
    .input("platform", sql.NVarChar, detectedPlatform)
    .input("scanDurationMs", sql.Int, scanDurationMs)
    .input("websiteStatus", sql.NVarChar, websiteStatus)
    .input("hostingProvider", sql.NVarChar, websiteInfo?.hostingProvider ?? null)
    .input("asn", sql.NVarChar, websiteInfo?.asn ?? null)
    .input("ipAddress", sql.NVarChar, websiteInfo?.ipAddress ?? null)
    .input("ipv6Address", sql.NVarChar, websiteInfo?.ipv6Address ?? null)
    .input("scoreHeaders", sql.Int, moduleScores.headers)
    .input("scoreSsl", sql.Int, moduleScores.ssl)
    .input("scoreAuth", sql.Int, moduleScores.auth)
    .input("scoreCookies", sql.Int, moduleScores.cookies)
    .input("scoreJs", sql.Int, moduleScores.js)
    .input("scoreDns", sql.Int, moduleScores.dns)
    .input("scoreEmail", sql.Int, moduleScores.email)
    .input("scoreServer", sql.Int, moduleScores.server)
    .input("scoreOwasp", sql.Int, moduleScores.owasp)
    .input("scorePerformance", sql.Int, moduleScores.performance)
    .query(`
      UPDATE WebsiteAuditScans SET
        Status = 'Completed', CompletedAt = SYSUTCDATETIME(), SecurityScore = @score, RiskLevel = @risk, DetectedPlatform = @platform,
        ScanDurationMs = @scanDurationMs, WebsiteStatus = @websiteStatus, HostingProvider = @hostingProvider, Asn = @asn,
        IpAddress = @ipAddress, Ipv6Address = @ipv6Address,
        ScoreHeaders = @scoreHeaders, ScoreSsl = @scoreSsl, ScoreAuth = @scoreAuth, ScoreCookies = @scoreCookies, ScoreJs = @scoreJs,
        ScoreDns = @scoreDns, ScoreEmail = @scoreEmail, ScoreServer = @scoreServer, ScoreOwasp = @scoreOwasp, ScorePerformance = @scorePerformance
      WHERE Id = @scanId
    `);

  await db
    .request()
    .input("websiteId", sql.Int, opts.websiteId)
    .input("scanId", sql.Int, scanId)
    .input("actorName", sql.NVarChar, opts.triggeredBy)
    .input("actorUserId", sql.Int, opts.triggeredByUserId)
    .query(
      `INSERT INTO WebsiteAuditActivityLogs (WebsiteId, ScanId, Action, ActorUserId, ActorName) VALUES (@websiteId, @scanId, 'scan_completed', @actorUserId, @actorName)`
    );

  await logProgress(scanId, `Scan completed — score ${securityScore}/100, risk ${riskLevel}.`);

  return {
    scanId,
    detectedPlatform,
    securityScore,
    riskLevel,
    findingCount: findings.length,
    dependencyFindingCount: dependencyFindings.length,
    codeFindingCount: codeFindings.length,
  };
}

// Runs all checks for an already-created scan row (see createScanRow) — split out so the
// manual-scan API route can kick this off without awaiting it (the route responds to the
// browser immediately with the scanId; this keeps running against the persistent Node
// process and the dashboard polls WebsiteAuditScanLog for progress). The outer try/catch
// here is a last-resort safety net beyond executeScanInner's own internal one: if something
// fails outside that (e.g. a DB write error while persisting results), the scan is marked
// 'Failed' instead of being left stuck at 'Running' forever, and the error re-thrown so a
// caller that DOES await this (like the daily-scan script) still sees the failure.
export async function executeScan(scanId: number, opts: RunScanOptions): Promise<ScanSummary> {
  try {
    return await executeScanInner(scanId, opts);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[runScan] scan ${scanId} failed unexpectedly:`, message);
    try {
      const db = await getDb();
      await db
        .request()
        .input("scanId", sql.Int, scanId)
        .query("UPDATE WebsiteAuditScans SET Status = 'Failed', CompletedAt = SYSUTCDATETIME() WHERE Id = @scanId");
      await logProgress(scanId, `Scan failed: ${message}`);
    } catch {
      // Truly nothing more we can do here — the scan will just remain in whatever state it
      // last reached.
    }
    throw err;
  }
}

// Backward-compatible convenience wrapper (used by the daily-scan script and anything else
// that wants the old synchronous create-then-run-to-completion behavior in one call).
export async function runScan(opts: RunScanOptions): Promise<ScanSummary> {
  const scanId = await createScanRow(opts);
  return executeScan(scanId, opts);
}

export { buildRecommendations, buildRemediationRoadmap };
