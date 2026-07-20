import dns from "dns";
import type { Finding } from "./types";

const FETCH_TIMEOUT_MS = 15000;
const UA = "LogMonitor-WebsiteSecurityAudit/1.0 (+authorized-scan)";

export interface WebsiteInfo {
  domain: string;
  ipAddress: string | null;
  ipv6Address: string | null;
  hostingProvider: string | null;
  asn: string | null;
  cdnOrWaf: string | null;
  reverseProxy: string | null;
  hasRobotsTxt: boolean;
  hasSitemapXml: boolean;
  hasSecurityTxt: boolean;
}

const CDN_WAF_SIGNATURES: [RegExp, string][] = [
  [/cloudflare/i, "Cloudflare"],
  [/akamai/i, "Akamai"],
  [/sucuri/i, "Sucuri"],
  [/incapsula|imperva/i, "Imperva/Incapsula"],
  [/cloudfront/i, "Amazon CloudFront"],
  [/fastly/i, "Fastly"],
];

function detectCdnWaf(headers: Headers): string | null {
  const combined = [
    headers.get("server"),
    headers.get("via"),
    headers.get("cf-ray") ? "cloudflare" : null,
    headers.get("x-sucuri-id") ? "sucuri" : null,
    headers.get("x-cdn"),
    headers.get("x-amz-cf-id") ? "cloudfront" : null,
  ]
    .filter(Boolean)
    .join(" ");
  for (const [re, name] of CDN_WAF_SIGNATURES) {
    if (re.test(combined)) return name;
  }
  return null;
}

function detectReverseProxy(headers: Headers): string | null {
  return headers.get("via") ?? headers.get("x-forwarded-server") ?? null;
}

// ip-api.com's free tier is a well-known, keyless, HTTP-only public IP-info lookup — best
// effort only, degrades to nulls if unreachable or rate-limited. Called against the scanned
// site's own public IP, never a third party's.
async function lookupIpInfo(ip: string): Promise<{ hostingProvider: string | null; asn: string | null }> {
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,as,isp,org`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { hostingProvider: null, asn: null };
    const data = (await res.json()) as { status: string; as?: string; isp?: string; org?: string };
    if (data.status !== "success") return { hostingProvider: null, asn: null };
    return { hostingProvider: data.org || data.isp || null, asn: data.as || null };
  } catch {
    return { hostingProvider: null, asn: null };
  }
}

async function pathExists(origin: string, path: string): Promise<boolean> {
  try {
    const res = await fetch(`${origin}${path}`, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": UA },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

export async function gatherWebsiteInfo(url: string, headers: Headers): Promise<{ info: WebsiteInfo; findings: Finding[] }> {
  const u = new URL(url);
  const findings: Finding[] = [];

  let ipAddress: string | null = null;
  let ipv6Address: string | null = null;
  try {
    const v4 = await dns.promises.resolve4(u.hostname);
    ipAddress = v4[0] ?? null;
  } catch {
    // no A record, or resolution failed — leave null
  }
  try {
    const v6 = await dns.promises.resolve6(u.hostname);
    ipv6Address = v6[0] ?? null;
  } catch {
    // no AAAA record — most sites don't have one, not a finding on its own
  }

  const cdnOrWaf = detectCdnWaf(headers);
  const reverseProxy = detectReverseProxy(headers);

  let hostingProvider: string | null = null;
  let asn: string | null = null;
  if (ipAddress) {
    const ipInfo = await lookupIpInfo(ipAddress);
    hostingProvider = ipInfo.hostingProvider;
    asn = ipInfo.asn;
  }

  const [hasRobotsTxt, hasSitemapXml, hasSecurityTxt] = await Promise.all([
    pathExists(u.origin, "/robots.txt"),
    pathExists(u.origin, "/sitemap.xml"),
    pathExists(u.origin, "/.well-known/security.txt"),
  ]);

  findings.push({
    category: "website_info_summary",
    severity: "info",
    title: "Website information summary",
    description: `IPv4: ${ipAddress ?? "none"} | IPv6: ${ipv6Address ?? "none"} | robots.txt: ${hasRobotsTxt ? "present" : "not found"} | sitemap.xml: ${
      hasSitemapXml ? "present" : "not found"
    } | Reverse proxy: ${reverseProxy ?? "none detected"}`,
  });

  if (cdnOrWaf) {
    findings.push({
      category: "cdn_waf_detected",
      severity: "info",
      title: `CDN/WAF detected: ${cdnOrWaf}`,
      description: "Positive control — informational only, not a weakness.",
    });
  }
  if (hostingProvider || asn) {
    findings.push({
      category: "hosting_info",
      severity: "info",
      title: `Hosting provider: ${hostingProvider ?? "unknown"}${asn ? ` (${asn})` : ""}`,
      description: "Informational asset/inventory data from a public IP-info lookup.",
    });
  }
  if (!hasSecurityTxt) {
    findings.push({
      category: "missing_security_txt",
      severity: "low",
      title: "No security.txt found",
      recommendation: "Publish /.well-known/security.txt so researchers have a standard way to report vulnerabilities responsibly.",
    });
  }

  const info: WebsiteInfo = {
    domain: u.hostname,
    ipAddress,
    ipv6Address,
    hostingProvider,
    asn,
    cdnOrWaf,
    reverseProxy,
    hasRobotsTxt,
    hasSitemapXml,
    hasSecurityTxt,
  };
  return { info, findings };
}
