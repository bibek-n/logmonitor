// Types shared between server-side scan logic and client components. Kept free of any
// server-only imports (no `fetch`-wrapping modules, no node builtins) so client components
// can import this file directly without pulling server code into the browser bundle.

export type CheckId =
  | "core_version_vulns"
  | "theme_vulns"
  | "interesting_headers"
  | "wp_cron"
  | "plugin_vulns"
  | "user_enum_xmlrpc"
  | "config_backups"
  | "timthumb";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type RiskLevel = "critical" | "high" | "medium" | "low" | "info" | "unknown";

export interface ScanFinding {
  check: CheckId;
  severity: Severity;
  title: string;
  detail?: string;
  evidence?: string;
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
  coreVersion: string | null;
  themeSlug: string | null;
  themeVersion: string | null;
  plugins: DetectedPlugin[];
  findings: ScanFinding[];
  checks: CheckSummary[];
  riskLevel: RiskLevel;
  scannedAt: string;
}

// The 8 check categories this scan covers, in display order — used to build the
// "Included" checklist UI regardless of whether a given scan actually ran/found anything
// for a check yet (e.g. before any scan has been run).
export const CHECK_LABELS: Record<CheckId, string> = {
  core_version_vulns: "Vulnerabilities in the core WordPress version",
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
  "theme_vulns",
  "interesting_headers",
  "wp_cron",
  "plugin_vulns",
  "user_enum_xmlrpc",
  "config_backups",
  "timthumb",
];
