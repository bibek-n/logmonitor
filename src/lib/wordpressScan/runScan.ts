import { detectWordPress } from "./detect";
import {
  checkConfigBackups,
  checkCoreUpdateAvailable,
  checkCoreVulnerabilities,
  checkInterestingHeaders,
  checkPhpCompatibility,
  checkPluginVulnerabilities,
  checkThemeVulnerabilities,
  checkTimThumb,
  checkUserEnumerationAndXmlRpc,
  checkWpCron,
} from "./checks";
import { isWpScanConfigured } from "./wpscanApi";
import { getLatestWordPressRelease } from "./wpOrgApi";
import {
  CHECK_LABELS,
  CHECK_ORDER,
  PROFILE_CHECKS,
  type CheckId,
  type CheckSummary,
  type RiskLevel,
  type ScanFinding,
  type ScanProfile,
  type WordPressScanReport,
} from "./shared";

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
export async function runWordPressDeepScan(
  inputUrl: string,
  onProgress?: ProgressFn,
  // PHP version already known from the Websites list's own scan, when this run is tied to a
  // saved website — this tool never re-detects PHP itself, see WordPressScanReport.phpVersion.
  knownPhpVersion?: string | null,
  // Defaults to "comprehensive" (every check) so any caller that doesn't pass this — older
  // API consumers, scripts written before profiles existed — keeps running exactly what it
  // always ran. Only the UI's new profile selector and the scheduler pass something else.
  profile: ScanProfile = "comprehensive"
): Promise<WordPressScanReport> {
  const log = (line: string) => onProgress?.(line);
  const activeChecks = new Set(PROFILE_CHECKS[profile]);
  const checkOrderForProfile = CHECK_ORDER.filter((id) => activeChecks.has(id));

  log(`[*] Fetching ${inputUrl} ...`);
  const detection = await detectWordPress(inputUrl);

  if (!detection.isWordPress) {
    log(
      detection.blockReason
        ? `[!] Scan blocked: ${detection.blockReason}`
        : `[!] WordPress was not detected at this URL — no wp-content/wp-includes/wp-json markers found.`
    );
    return {
      targetUrl: detection.finalUrl,
      isWordPress: false,
      blockReason: detection.blockReason,
      coreVersion: null,
      phpVersion: knownPhpVersion ?? null,
      latestCoreVersion: null,
      corePhpRequirement: null,
      themeSlug: null,
      themeVersion: null,
      plugins: [],
      findings: [],
      checks: [],
      riskLevel: "unknown",
      scannedAt: new Date().toISOString(),
      profile,
    };
  }

  if (detection.viaHeadlessBrowser) {
    log(`[i] Plain fetch was blocked by an anti-bot/JS challenge - retried with a headless browser, which got through.`);
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
    log(`[i] WPSCAN_API_TOKEN is not configured — core/theme/plugin vulnerability-database lookups will report 0 findings until it's set. Core update/PHP compatibility checks below don't need it.`);
  }

  log(`[*] Checking WordPress.org for the latest core release ...`);
  const { latestVersion: latestCoreVersion, requiredPhpVersion: corePhpRequirement } = await getLatestWordPressRelease();
  log(
    latestCoreVersion
      ? `[+] Latest WordPress release: ${latestCoreVersion}${corePhpRequirement ? ` (recommends PHP ${corePhpRequirement}+)` : ""}`
      : `[-] Could not reach WordPress.org's update-check API.`
  );
  log(knownPhpVersion ? `[+] PHP version (from Websites list): ${knownPhpVersion}` : `[i] No saved PHP version for this site.`);

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
    // having to parse the human-readable log lines above. Denominator is the profile's own
    // check count, not CHECK_ORDER.length, so a Quick scan's bar still reaches 100%.
    log(`__PROGRESS__${checks.length}/${checkOrderForProfile.length}`);
  }

  if (activeChecks.has("core_version_vulns")) await runCheck("core_version_vulns", () => checkCoreVulnerabilities(detection.coreVersion));
  if (activeChecks.has("core_update_available")) await runCheck("core_update_available", () => checkCoreUpdateAvailable(detection.coreVersion, latestCoreVersion));
  if (activeChecks.has("php_compatibility")) await runCheck("php_compatibility", () => checkPhpCompatibility(knownPhpVersion ?? null, corePhpRequirement));
  if (activeChecks.has("theme_vulns")) await runCheck("theme_vulns", () => checkThemeVulnerabilities(detection.themeSlug, detection.themeVersion));
  if (activeChecks.has("interesting_headers")) await runCheck("interesting_headers", () => checkInterestingHeaders(detection.headers));
  if (activeChecks.has("wp_cron")) await runCheck("wp_cron", () => checkWpCron(detection.finalUrl));
  if (activeChecks.has("plugin_vulns")) await runCheck("plugin_vulns", () => checkPluginVulnerabilities(detection.plugins));
  if (activeChecks.has("user_enum_xmlrpc")) await runCheck("user_enum_xmlrpc", () => checkUserEnumerationAndXmlRpc(detection.finalUrl));
  if (activeChecks.has("config_backups")) await runCheck("config_backups", () => checkConfigBackups(detection.finalUrl));
  if (activeChecks.has("timthumb")) await runCheck("timthumb", () => checkTimThumb(detection.finalUrl, detection.themeSlug));

  const riskLevel = computeRiskLevel(findings);
  log(`[*] Scan complete — risk level: ${riskLevel.toUpperCase()}, ${findings.length} total finding(s).`);

  return {
    targetUrl: detection.finalUrl,
    isWordPress: true,
    blockReason: null,
    coreVersion: detection.coreVersion,
    phpVersion: knownPhpVersion ?? null,
    latestCoreVersion,
    corePhpRequirement,
    themeSlug: detection.themeSlug,
    themeVersion: detection.themeVersion,
    plugins: detection.plugins,
    findings,
    checks,
    riskLevel,
    scannedAt: new Date().toISOString(),
    profile,
  };
}
