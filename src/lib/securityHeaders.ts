import dns from "node:dns/promises";
import { isValidUrl } from "@/lib/websiteTools";

const FETCH_TIMEOUT_MS = 15000;

// The headers securityheaders.com-style reports treat as the core security
// baseline every site should set.
export const CORE_HEADERS = [
  "x-content-type-options",
  "x-frame-options",
  "content-security-policy",
  "strict-transport-security",
  "referrer-policy",
  "permissions-policy",
] as const;

// Newer isolation headers — not yet as universally adopted, shown as their
// own "Upcoming" section rather than counted against the grade.
export const UPCOMING_HEADERS = ["cross-origin-embedder-policy", "cross-origin-opener-policy", "cross-origin-resource-policy"] as const;

// Plain-language explainer shown for a header whenever it's present in the
// response (in "Additional Information") or, for CORE_HEADERS/UPCOMING_HEADERS,
// whenever it's missing (in "Missing Headers").
export const HEADER_INFO: Record<string, string> = {
  "x-content-type-options":
    'Stops the browser from trying to MIME-sniff the content type and forces it to stick with the declared Content-Type. The only valid value is "nosniff".',
  "x-frame-options": "Tells the browser whether this site can be loaded inside a frame. Restricting framing defends against clickjacking attacks.",
  "content-security-policy":
    "An effective defense against XSS attacks — by allow-listing approved sources of content, it stops the browser from loading malicious or unexpected assets.",
  "strict-transport-security":
    "Strengthens TLS by instructing browsers to always reach this site over HTTPS, even if a user types or links to a plain http:// URL.",
  "referrer-policy": "Controls how much information the browser includes in the Referer header when navigating away from this site.",
  "permissions-policy": "Lets a site control which browser features and APIs (camera, geolocation, microphone, etc.) can be used on the page.",
  "cross-origin-embedder-policy": "Prevents this page from loading cross-origin resources that don't explicitly grant it permission via CORS or CORP.",
  "cross-origin-opener-policy": "Lets a site opt into cross-origin isolation in the browser, separating its browsing context from cross-origin documents.",
  "cross-origin-resource-policy": "Lets a resource owner declare which origins are allowed to load that resource.",
  "report-to": "Enables the Reporting API, letting the browser send this site reports about deprecations, CSP violations, and other errors it encounters.",
  nel: "Network Error Logging instructs the browser to send reports when it hits network or application errors loading this site.",
  server: "Identifies the server software handling the request — worth reviewing whether exposing this value gives attackers useful reconnaissance.",
  "x-xss-protection":
    "Configures the legacy XSS Auditor built into older browsers. Deprecated in modern browsers, which rely on Content-Security-Policy instead.",
};

export interface SecurityHeaderReport {
  targetUrl: string;
  finalUrl: string;
  ipAddress: string | null;
  statusCode: number;
  headers: Record<string, string>;
  present: string[];
  missing: string[];
  upcomingMissing: string[];
  grade: string;
  score: number;
  scannedAt: string;
}

// Approximate grading, not a claimed replica of any third-party service's
// proprietary algorithm: each of the 6 core headers contributes evenly to a
// 90-point base, plus up to 10 bonus points for two commonly-checked
// strength signals (a long-lived HSTS max-age, and a CSP that avoids the
// 'unsafe-inline'/'unsafe-eval' escape hatches).
function computeGrade(present: Set<string>, headers: Record<string, string>): { grade: string; score: number } {
  const presentCount = CORE_HEADERS.filter((h) => present.has(h)).length;
  let score = Math.round((presentCount / CORE_HEADERS.length) * 90);

  const hsts = headers["strict-transport-security"];
  const hstsMatch = hsts ? /max-age=(\d+)/i.exec(hsts) : null;
  if (hstsMatch && Number(hstsMatch[1]) >= 31536000) score += 5;

  const csp = headers["content-security-policy"];
  if (csp && !/unsafe-inline|unsafe-eval/i.test(csp)) score += 5;

  score = Math.min(100, score);

  let grade: string;
  if (score >= 95) grade = "A+";
  else if (score >= 85) grade = "A";
  else if (score >= 70) grade = "B";
  else if (score >= 55) grade = "C";
  else if (score >= 40) grade = "D";
  else if (score >= 20) grade = "E";
  else grade = "F";

  return { grade, score };
}

export async function analyzeSecurityHeaders(inputUrl: string): Promise<SecurityHeaderReport> {
  const parsed = isValidUrl(inputUrl);
  if (!parsed) throw new Error("Invalid URL — must start with http:// or https://");

  const res = await fetch(inputUrl, { redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const present = CORE_HEADERS.filter((h) => headers[h] !== undefined);
  const missing = CORE_HEADERS.filter((h) => headers[h] === undefined);
  const upcomingMissing = UPCOMING_HEADERS.filter((h) => headers[h] === undefined);
  const { grade, score } = computeGrade(new Set(present), headers);

  let ipAddress: string | null = null;
  try {
    const finalHostname = new URL(res.url).hostname;
    const resolved = await dns.lookup(finalHostname);
    ipAddress = resolved.address;
  } catch {
    ipAddress = null;
  }

  return {
    targetUrl: inputUrl,
    finalUrl: res.url,
    ipAddress,
    statusCode: res.status,
    headers,
    present,
    missing,
    upcomingMissing,
    grade,
    score,
    scannedAt: new Date().toISOString(),
  };
}
