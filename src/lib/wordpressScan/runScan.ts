import { detectWordPress } from "./detect";
import {
  checkConfigBackups,
  checkCoreVulnerabilities,
  checkInterestingHeaders,
  checkPluginVulnerabilities,
  checkThemeVulnerabilities,
  checkTimThumb,
  checkUserEnumerationAndXmlRpc,
  checkWpCron,
} from "./checks";
import { isWpScanConfigured } from "./wpscanApi";
import { CHECK_LABELS, CHECK_ORDER, type CheckId, type CheckSummary, type RiskLevel, type ScanFinding, type WordPressScanReport } from "./shared";

export type ProgressFn = (line: string) => void;

function computeRiskLevel(findings: ScanFinding[]): RiskLevel {
  if (findings.some((f) => f.severity === "critical")) return "critical";
  if (findings.some((f) => f.severity === "high")) return "high";
  if (findings.some((f) => f.severity === "medium")) return "medium";
  if (findings.some((f) => f.severity === "low")) return "low";
  return "info";
}

// Drives every check for one scan, emitting a CLI-style progress line as each check
// starts/finishes — the same report this produces is used both by the synchronous JSON
// API route and (via onProgress) the streaming CLI terminal, so the two surfaces can never
// drift out of sync with each other.
export async function runWordPressDeepScan(inputUrl: string, onProgress?: ProgressFn): Promise<WordPressScanReport> {
  const log = (line: string) => onProgress?.(line);

  log(`[*] Fetching ${inputUrl} ...`);
  const detection = await detectWordPress(inputUrl);

  if (!detection.isWordPress) {
    log(`[!] WordPress was not detected at this URL — no wp-content/wp-includes/wp-json markers found.`);
    return {
      targetUrl: detection.finalUrl,
      isWordPress: false,
      coreVersion: null,
      themeSlug: null,
      themeVersion: null,
      plugins: [],
      findings: [],
      checks: [],
      riskLevel: "unknown",
      scannedAt: new Date().toISOString(),
    };
  }

  log(`[+] WordPress detected at ${detection.finalUrl}`);
  log(detection.coreVersion ? `[+] Core version: ${detection.coreVersion}` : `[-] Could not determine core version.`);
  if (detection.themeSlug) {
    log(`[+] Active theme: ${detection.themeSlug}${detection.themeVersion ? ` v${detection.themeVersion}` : " (version unknown)"}`);
  } else {
    log(`[-] Could not determine active theme.`);
  }
  log(
    detection.plugins.length
      ? `[+] Detected ${detection.plugins.length} plugin(s) from page assets: ${detection.plugins.map((p) => p.slug).join(", ")}`
      : `[-] No plugins detected from page assets (server-side-only plugins won't show up here).`
  );

  if (!isWpScanConfigured()) {
    log(`[i] WPSCAN_API_TOKEN is not configured — core/theme/plugin vulnerability lookups will report 0 findings until it's set.`);
  }

  const findings: ScanFinding[] = [];
  const checks: CheckSummary[] = [];

  async function runCheck(id: CheckId, fn: () => Promise<ScanFinding[]>): Promise<void> {
    const label = CHECK_LABELS[id];
    log(`[*] Running check: ${label} ...`);
    try {
      const results = await fn();
      findings.push(...results);
      checks.push({ check: id, label, status: results.length ? "issues_found" : "ok", findingCount: results.length });
      log(results.length ? `[!] ${label}: ${results.length} finding(s)` : `[+] ${label}: clear`);
    } catch (err) {
      checks.push({ check: id, label, status: "error", findingCount: 0 });
      log(`[-] ${label}: check failed (${err instanceof Error ? err.message : "unknown error"})`);
    }
    // Machine-readable sentinel (not meant for human display — see ScanTerminal/
    // WordPressScanClient, both of which filter this out of what they print and use it
    // only to drive a numeric progress bar) so the UI can show "N of 8 checks" without
    // having to parse the human-readable log lines above.
    log(`__PROGRESS__${checks.length}/${CHECK_ORDER.length}`);
  }

  await runCheck("core_version_vulns", () => checkCoreVulnerabilities(detection.coreVersion));
  await runCheck("theme_vulns", () => checkThemeVulnerabilities(detection.themeSlug, detection.themeVersion));
  await runCheck("interesting_headers", () => checkInterestingHeaders(detection.headers));
  await runCheck("wp_cron", () => checkWpCron(detection.finalUrl));
  await runCheck("plugin_vulns", () => checkPluginVulnerabilities(detection.plugins));
  await runCheck("user_enum_xmlrpc", () => checkUserEnumerationAndXmlRpc(detection.finalUrl));
  await runCheck("config_backups", () => checkConfigBackups(detection.finalUrl));
  await runCheck("timthumb", () => checkTimThumb(detection.finalUrl, detection.themeSlug));

  const riskLevel = computeRiskLevel(findings);
  log(`[*] Scan complete — risk level: ${riskLevel.toUpperCase()}, ${findings.length} total finding(s).`);

  return {
    targetUrl: detection.finalUrl,
    isWordPress: true,
    coreVersion: detection.coreVersion,
    themeSlug: detection.themeSlug,
    themeVersion: detection.themeVersion,
    plugins: detection.plugins,
    findings,
    checks,
    riskLevel,
    scannedAt: new Date().toISOString(),
  };
}
