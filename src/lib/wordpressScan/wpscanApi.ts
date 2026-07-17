// Optional integration with the WPScan Vulnerability Database's free API
// (https://wpscan.com/api) — the industry-standard, actively-maintained source of
// WordPress core/theme/plugin CVE data. Entirely opt-in: without WPSCAN_API_TOKEN set,
// every function here returns an empty result instead of throwing, so the rest of the
// scan (detection + the passive checks) still runs and reports findings — core/theme/
// plugin vulnerability checks just won't have anything to report until a token is added.
//
// Only a version string or plugin/theme slug is ever sent to WPScan's API — never the
// scanned site's URL — so this doesn't disclose which of your sites is being scanned.

import type { Severity } from "./shared";

const WPSCAN_API_BASE = "https://wpscan.com/api/v3";
const FETCH_TIMEOUT_MS = 10000;

export interface WpVulnResult {
  title: string;
  severity: Severity;
  fixedIn: string | null;
  reference: string | null;
}

function getToken(): string | null {
  return process.env.WPSCAN_API_TOKEN?.trim() || null;
}

export function isWpScanConfigured(): boolean {
  return getToken() !== null;
}

async function wpscanGet(path: string): Promise<Record<string, unknown> | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${WPSCAN_API_BASE}${path}`, {
      headers: { Authorization: `Token token=${token}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

interface RawVuln {
  title?: string;
  fixed_in?: string | null;
  references?: { url?: string[] };
}

// WPScan's raw API doesn't return a normalized severity field — this is an approximate
// heuristic (unpatched == critical, patched-but-you're-behind == high), not a CVSS score.
function toResult(v: RawVuln): WpVulnResult {
  return {
    title: v.title ?? "Unnamed vulnerability",
    severity: v.fixed_in ? "high" : "critical",
    fixedIn: v.fixed_in ?? null,
    reference: v.references?.url?.[0] ?? null,
  };
}

export async function lookupCoreVulnerabilities(version: string): Promise<WpVulnResult[]> {
  // WPScan's /wordpresses/{id} endpoint doesn't take the dotted version string directly —
  // {id} is the version with dots stripped (e.g. "6.4.2" -> "642", confirmed empirically
  // against their API: /wordpresses/642 returns the "6.4.2" entry). Passing the literal
  // dotted string 404s with {"status":"wordpress not found"}.
  const id = version.replace(/\./g, "");
  const data = await wpscanGet(`/wordpresses/${id}`);
  if (!data) return [];
  const entry = data[Object.keys(data)[0]] as { vulnerabilities?: RawVuln[] } | undefined;
  return (entry?.vulnerabilities ?? []).map(toResult);
}

export async function lookupThemeVulnerabilities(slug: string): Promise<WpVulnResult[]> {
  const data = await wpscanGet(`/themes/${encodeURIComponent(slug)}`);
  if (!data) return [];
  const entry = data[slug] as { vulnerabilities?: RawVuln[] } | undefined;
  return (entry?.vulnerabilities ?? []).map(toResult);
}

export async function lookupPluginVulnerabilities(slug: string): Promise<WpVulnResult[]> {
  const data = await wpscanGet(`/plugins/${encodeURIComponent(slug)}`);
  if (!data) return [];
  const entry = data[slug] as { vulnerabilities?: RawVuln[] } | undefined;
  return (entry?.vulnerabilities ?? []).map(toResult);
}
