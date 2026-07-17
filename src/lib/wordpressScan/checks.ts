import type { DetectedPlugin, ScanFinding } from "./shared";
import { lookupCoreVulnerabilities, lookupPluginVulnerabilities, lookupThemeVulnerabilities } from "./wpscanApi";

const FETCH_TIMEOUT_MS = 10000;
// Passive recon checks (config-backup search, TimThumb search) run several probes
// concurrently, but capped — not unbounded parallel fan-out against someone else's server.
const PROBE_CONCURRENCY = 6;

interface ProbeResult {
  path: string;
  status: number;
}

async function probe(url: string): Promise<{ status: number }> {
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    return { status: res.status };
  } catch {
    return { status: 0 };
  }
}

async function probeAll(baseUrl: string, paths: string[]): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  for (let i = 0; i < paths.length; i += PROBE_CONCURRENCY) {
    const batch = paths.slice(i, i + PROBE_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (p) => ({ path: p, status: (await probe(new URL(p, baseUrl).toString())).status }))
    );
    results.push(...batchResults);
  }
  return results;
}

export async function checkCoreVulnerabilities(coreVersion: string | null): Promise<ScanFinding[]> {
  if (!coreVersion) return [];
  const vulns = await lookupCoreVulnerabilities(coreVersion);
  return vulns.map((v) => ({
    check: "core_version_vulns",
    severity: v.severity,
    title: `WordPress core ${coreVersion}: ${v.title}`,
    detail: v.fixedIn ? `Fixed in ${v.fixedIn} — this site is running an older, vulnerable version.` : "No fixed version published yet.",
    evidence: v.reference ?? undefined,
  }));
}

export async function checkThemeVulnerabilities(themeSlug: string | null, themeVersion: string | null): Promise<ScanFinding[]> {
  if (!themeSlug) return [];
  const vulns = await lookupThemeVulnerabilities(themeSlug);
  return vulns.map((v) => ({
    check: "theme_vulns",
    severity: v.severity,
    title: `Theme "${themeSlug}"${themeVersion ? ` v${themeVersion}` : ""}: ${v.title}`,
    detail: v.fixedIn ? `Fixed in ${v.fixedIn}.` : "No fixed version published yet.",
    evidence: v.reference ?? undefined,
  }));
}

export async function checkPluginVulnerabilities(plugins: DetectedPlugin[]): Promise<ScanFinding[]> {
  const findings: ScanFinding[] = [];
  for (const plugin of plugins) {
    const vulns = await lookupPluginVulnerabilities(plugin.slug);
    for (const v of vulns) {
      findings.push({
        check: "plugin_vulns",
        severity: v.severity,
        title: `Plugin "${plugin.slug}"${plugin.version ? ` v${plugin.version}` : ""}: ${v.title}`,
        detail: v.fixedIn ? `Fixed in ${v.fixedIn}.` : "No fixed version published yet.",
        evidence: v.reference ?? undefined,
      });
    }
  }
  return findings;
}

// "Interesting" here means informative/leaky, not the missing-hardening-header sense used
// by the separate Security Headers tool — this flags headers that fingerprint the stack or
// (x-pingback specifically) hand an attacker the site's own XML-RPC endpoint directly.
const INTERESTING_HEADER_KEYS = ["server", "x-powered-by", "x-generator", "via", "x-pingback"];

export async function checkInterestingHeaders(headers: Record<string, string>): Promise<ScanFinding[]> {
  const findings: ScanFinding[] = [];
  for (const key of INTERESTING_HEADER_KEYS) {
    const value = headers[key];
    if (!value) continue;
    findings.push({
      check: "interesting_headers",
      severity: "info",
      title: `${key}: ${value}`,
    });
  }
  if (headers["link"]?.includes("wp-json")) {
    findings.push({ check: "interesting_headers", severity: "info", title: "WP REST API discovery link is advertised", detail: headers["link"] });
  }
  return findings;
}

export async function checkWpCron(baseUrl: string): Promise<ScanFinding[]> {
  const { status } = await probe(new URL("/wp-cron.php", baseUrl).toString());
  if (status === 200) {
    return [
      {
        check: "wp_cron",
        severity: "low",
        title: "wp-cron.php is publicly accessible",
        detail:
          "Anyone can trigger WordPress's scheduled-task runner directly, which can be abused for low-effort denial-of-service on busy sites. Consider disabling the built-in pseudo-cron (DISABLE_WP_CRON) and triggering it from a real system cron job instead.",
      },
    ];
  }
  return [];
}

export async function checkUserEnumerationAndXmlRpc(baseUrl: string): Promise<ScanFinding[]> {
  const findings: ScanFinding[] = [];

  const usersRes = await probe(new URL("/wp-json/wp/v2/users", baseUrl).toString());
  if (usersRes.status === 200) {
    findings.push({
      check: "user_enum_xmlrpc",
      severity: "medium",
      title: "WP REST API user enumeration is possible",
      detail: "/wp-json/wp/v2/users returns a list of usernames without authentication, useful to an attacker building a credential-stuffing/brute-force target list.",
    });
  }

  const xmlrpcRes = await probe(new URL("/xmlrpc.php", baseUrl).toString());
  if (xmlrpcRes.status === 200 || xmlrpcRes.status === 405) {
    findings.push({
      check: "user_enum_xmlrpc",
      severity: "low",
      title: "XML-RPC is enabled",
      detail: "xmlrpc.php responds, which historically has been abused for pingback-based DDoS amplification and multi-call login brute-forcing. Disable it if nothing on the site depends on it (e.g. Jetpack, some mobile apps).",
    });
  }

  return findings;
}

// Common backup/export filenames left behind by editors, deploy scripts, or manual DB
// dumps. Every request is a plain GET against a path — no fuzzing beyond this fixed,
// well-known list, matching the non-destructive-recon posture of the other checks here.
const BACKUP_PATHS = [
  "wp-config.php.bak",
  "wp-config.bak",
  "wp-config.old",
  "wp-config.php~",
  "wp-config.php.save",
  "wp-config.php.orig",
  ".wp-config.php.swp",
  "backup.sql",
  "database.sql",
  "db.sql",
  "dump.sql",
  ".env",
  ".env.bak",
  "config.php.bak",
  "wp-content/backup.zip",
  "wp-content/uploads/backup.zip",
];

export async function checkConfigBackups(baseUrl: string): Promise<ScanFinding[]> {
  const results = await probeAll(baseUrl, BACKUP_PATHS);
  return results
    .filter((r) => r.status === 200)
    .map((r) => ({
      check: "config_backups",
      severity: "critical",
      title: `Exposed backup/config file: /${r.path}`,
      detail: "This path returned HTTP 200 and may leak database credentials, secrets, or a full database dump. Remove it or block public access immediately.",
    }));
}

// TimThumb (a once-ubiquitous PHP image-resize script bundled into many WordPress themes
// and plugins circa 2011) had multiple remote-code-execution CVEs (CVE-2011-4106 and
// follow-ups). It's rare on modern sites but still worth a quick, cheap check.
export async function checkTimThumb(baseUrl: string, themeSlug: string | null): Promise<ScanFinding[]> {
  const candidates = ["timthumb.php"];
  if (themeSlug) {
    candidates.push(
      `wp-content/themes/${themeSlug}/timthumb.php`,
      `wp-content/themes/${themeSlug}/scripts/timthumb.php`,
      `wp-content/themes/${themeSlug}/includes/timthumb.php`,
      `wp-content/themes/${themeSlug}/thumb.php`
    );
  }
  const results = await probeAll(baseUrl, candidates);
  return results
    .filter((r) => r.status === 200)
    .map((r) => ({
      check: "timthumb",
      severity: "high",
      title: `TimThumb script found: /${r.path}`,
      detail: "Older TimThumb versions have multiple known remote code execution vulnerabilities. Confirm the version in use and update or remove the script if it's outdated.",
    }));
}
