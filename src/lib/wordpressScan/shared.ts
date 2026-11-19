// Types shared between server-side scan logic and client components. Kept free of any
// server-only imports (no `fetch`-wrapping modules, no node builtins) so client components
// can import this file directly without pulling server code into the browser bundle.

export type CheckId =
  | "core_version_vulns"
  | "core_update_available"
  | "php_compatibility"
  | "theme_vulns"
  | "interesting_headers"
  | "wp_cron"
  | "plugin_vulns"
  | "user_enum_xmlrpc"
  | "config_backups"
  | "timthumb";

export type ScanProfile = "quick" | "standard" | "comprehensive";

export const SCAN_PROFILE_LABELS: Record<ScanProfile, string> = {
  quick: "Quick",
  standard: "Standard",
  comprehensive: "Comprehensive",
};

// Which checks each profile runs, in CHECK_ORDER's order. Quick = fast, no crawling/path
// probing. Standard = Quick plus the moderate checks. Comprehensive = everything, including
// the two slowest/most intrusive path-probing checks (config_backups, timthumb). A scan with
// no profile specified (older API callers, the daily-scan-equivalent scripts) defaults to
// "comprehensive" elsewhere so existing behavior is unchanged for anyone not using this yet.
export const PROFILE_CHECKS: Record<ScanProfile, CheckId[]> = {
  quick: ["core_version_vulns", "core_update_available", "interesting_headers", "user_enum_xmlrpc"],
  standard: [
    "core_version_vulns",
    "core_update_available",
    "php_compatibility",
    "theme_vulns",
    "interesting_headers",
    "wp_cron",
    "plugin_vulns",
    "user_enum_xmlrpc",
  ],
  comprehensive: [
    "core_version_vulns",
    "core_update_available",
    "php_compatibility",
    "theme_vulns",
    "interesting_headers",
    "wp_cron",
    "plugin_vulns",
    "user_enum_xmlrpc",
    "config_backups",
    "timthumb",
  ],
};

export function isScanProfile(value: unknown): value is ScanProfile {
  return value === "quick" || value === "standard" || value === "comprehensive";
}

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type RiskLevel = "critical" | "high" | "medium" | "low" | "info" | "unknown";

export interface ScanFinding {
  check: CheckId;
  severity: Severity;
  title: string;
  detail?: string;
  evidence?: string;
  // The concrete fix, shown separately from `detail` (which explains the risk) - same
  // detail/recommendation split the Website Security Audit scanner uses.
  recommendation?: string;
}

export type CheckStatus = "ok" | "issues_found" | "not_applicable" | "error";

export interface CheckSummary {
  check: CheckId;
  label: string;
  status: CheckStatus;
  findingCount: number;
}

export interface DetectedPlugin {
  slug: string;
  version: string | null;
}

export interface WordPressScanReport {
  targetUrl: string;
  isWordPress: boolean;
  // Set only when isWordPress is false AND the page we fetched looked like an anti-bot/JS
  // challenge rather than real content (see src/lib/wordpressScan/detect.ts). Lets the UI/PDF
  // say "could not confirm, scan was blocked" instead of the misleading "WordPress was not
  // detected" when the real page was never actually seen.
  blockReason: string | null;
  coreVersion: string | null;
  // The site's PHP version, pulled from the Websites list's own PHP Version column when this
  // scan is tied to a saved website (null for an ad-hoc URL not in that list) — this tool
  // doesn't re-detect PHP itself, it reuses the existing Websites-list scan so the two never
  // disagree about the same site.
  phpVersion: string | null;
  // From WordPress.org's own free update-check API (wpOrgApi.ts) — no WPSCAN_API_TOKEN
  // required, unlike the vulnerability-database lookups below.
  latestCoreVersion: string | null;
  corePhpRequirement: string | null;
  themeSlug: string | null;
  themeVersion: string | null;
  plugins: DetectedPlugin[];
  findings: ScanFinding[];
  checks: CheckSummary[];
  riskLevel: RiskLevel;
  scannedAt: string;
  profile: ScanProfile;
}

// The check categories this scan covers, in display order — used to build the "Included"
// checklist UI regardless of whether a given scan actually ran/found anything for a check yet
// (e.g. before any scan has been run).
export const CHECK_LABELS: Record<CheckId, string> = {
  core_version_vulns: "Vulnerabilities in the core WordPress version",
  core_update_available: "WordPress core update available",
  php_compatibility: "PHP version vs WordPress's recommended minimum",
  theme_vulns: "Vulnerabilities in the main WordPress theme",
  interesting_headers: "Interesting headers",
  wp_cron: "WP-cron enabled check",
  plugin_vulns: "WordPress plugin vulnerabilities",
  user_enum_xmlrpc: "User enumeration & XML-RPC enabled check",
  config_backups: "Config backups & database exports search",
  timthumb: "TimThumb search",
};

export const CHECK_ORDER: CheckId[] = [
  "core_version_vulns",
  "core_update_available",
  "php_compatibility",
  "theme_vulns",
  "interesting_headers",
  "wp_cron",
  "plugin_vulns",
  "user_enum_xmlrpc",
  "config_backups",
  "timthumb",
];
