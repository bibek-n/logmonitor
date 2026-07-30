import dns from "dns/promises";
import net from "net";
import { UrlInspectionResult, UrlRules } from "./types";

interface CloudProviderRule {
  name: string;
  domains: string[];
}

// Initial provider set from the spec, plus room for admin-configured custom domains via
// UrlRules.blockedProviders / allowlist — this table is the built-in default, not the only
// source of truth.
export const CLOUD_PROVIDERS: CloudProviderRule[] = [
  { name: "Google Drive", domains: ["drive.google.com", "docs.google.com"] },
  { name: "Microsoft OneDrive", domains: ["onedrive.live.com", "1drv.ms"] },
  { name: "SharePoint", domains: ["sharepoint.com"] },
  { name: "Dropbox", domains: ["dropbox.com", "dl.dropboxusercontent.com"] },
  { name: "Box", domains: ["box.com", "app.box.com"] },
  { name: "iCloud Drive", domains: ["icloud.com"] },
  { name: "WeTransfer", domains: ["wetransfer.com", "we.tl"] },
];

const KNOWN_SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly",
]);

const MAX_REDIRECTS = 5;
const REDIRECT_TIMEOUT_MS = 5000;

function matchesDomain(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase();
  const target = domain.toLowerCase();
  return host === target || host.endsWith(`.${target}`);
}

function findCloudProvider(hostname: string, extra: string[]): string | null {
  for (const provider of CLOUD_PROVIDERS) {
    if (provider.domains.some((d) => matchesDomain(hostname, d))) return provider.name;
  }
  for (const domain of extra) {
    if (matchesDomain(hostname, domain)) return domain;
  }
  return null;
}

function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true; // includes 169.254.169.254 cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 unique local
    if (lower.startsWith("fe80")) return true; // link-local
    return false;
  }
  return false;
}

// SSRF guard: before ever connecting to a hop while resolving redirects, resolve its hostname
// and refuse to proceed if any resolved address is private/loopback/link-local/cloud-metadata.
// This app never fetches remote content from internal/private network addresses, per the
// spec's explicit requirement.
async function isSafeToFetch(hostname: string): Promise<boolean> {
  try {
    const results = await dns.lookup(hostname, { all: true });
    return results.every((r) => !isPrivateOrReservedIp(r.address));
  } catch {
    // Unresolvable hostname - treat as unsafe rather than silently proceeding.
    return false;
  }
}

function isLookalikeDomain(hostname: string, allowlist: string[]): boolean {
  if (!hostname.toLowerCase().includes("xn--")) return false;
  // A punycode label is only suspicious if it isn't itself an allowlisted domain - some
  // legitimate international domains are punycode-encoded.
  return !allowlist.some((d) => matchesDomain(hostname, d));
}

async function resolveRedirects(originalUrl: string): Promise<{ finalUrl: string; ssrfBlocked: boolean }> {
  let current = originalUrl;
  for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return { finalUrl: current, ssrfBlocked: false };
    }

    if (!(await isSafeToFetch(parsed.hostname))) {
      return { finalUrl: current, ssrfBlocked: true };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REDIRECT_TIMEOUT_MS);
      const res = await fetch(current, { method: "HEAD", redirect: "manual", signal: controller.signal });
      clearTimeout(timer);

      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        current = new URL(location, current).toString();
        continue;
      }
      return { finalUrl: current, ssrfBlocked: false };
    } catch {
      // Network error / timeout resolving the redirect - report what we have so far rather
      // than failing the whole inspection.
      return { finalUrl: current, ssrfBlocked: false };
    }
  }
  return { finalUrl: current, ssrfBlocked: false };
}

// Provider-agnostic URL/cloud-link inspection: normalizes the URL, resolves redirects (with
// an SSRF guard on every hop), and flags shortened links and lookalike/punycode domains, then
// leaves the actual block/allow decision to the policy engine (this function only reports
// facts, it never decides).
export async function inspectUrl(originalUrl: string, rules: UrlRules): Promise<UrlInspectionResult> {
  let normalized: URL;
  try {
    normalized = new URL(originalUrl.trim());
  } catch {
    return {
      originalUrl,
      resolvedUrl: null,
      domain: null,
      cloudProvider: null,
      isShortenedLink: false,
      isLookalikeDomain: false,
      blockedReason: "Malformed URL",
      ssrfBlocked: false,
    };
  }

  const isShortenedLink = KNOWN_SHORTENERS.has(normalized.hostname.toLowerCase());
  let resolvedUrl = normalized.toString();
  let ssrfBlocked = false;

  if (isShortenedLink) {
    const result = await resolveRedirects(normalized.toString());
    resolvedUrl = result.finalUrl;
    ssrfBlocked = result.ssrfBlocked;
  }

  const finalHostname = (() => {
    try {
      return new URL(resolvedUrl).hostname;
    } catch {
      return normalized.hostname;
    }
  })();

  const cloudProvider = findCloudProvider(finalHostname, rules.blockedProviders);
  const lookalike = isLookalikeDomain(finalHostname, rules.allowlist);

  return {
    originalUrl,
    resolvedUrl,
    domain: finalHostname,
    cloudProvider,
    isShortenedLink,
    isLookalikeDomain: lookalike,
    blockedReason: null,
    ssrfBlocked,
  };
}
