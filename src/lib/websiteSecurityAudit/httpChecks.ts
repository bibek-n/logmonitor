import type { Finding } from "./types";
import { safeFetch as sharedSafeFetch } from "./safeNetwork";

const FETCH_TIMEOUT_MS = 15000;
const UA = "LogMonitor-WebsiteSecurityAudit/1.0 (+authorized-scan)";

// Existence-check only: a HEAD/GET that returns 200 means the path is reachable, which is
// itself the finding — the response body is never parsed/used beyond that, since acting on
// its contents would cross from "detect exposure" into "use exposed data," which this
// scanner deliberately never does.
const SENSITIVE_PATHS = [
  "/.env",
  "/.env.local",
  "/.git/config",
  "/.git/HEAD",
  "/wp-config.php.bak",
  "/config.php.bak",
  "/.aws/credentials",
  "/.ssh/id_rsa",
  "/backup.sql",
  "/database.sql",
  "/.htpasswd",
  "/composer.lock",
  "/web.config",
  "/phpinfo.php",
];

const ADMIN_API_PATHS = ["/wp-admin/", "/admin/", "/api/", "/graphql", "/swagger.json", "/swagger-ui.html", "/.well-known/security.txt"];

async function safeFetch(url: string, init?: RequestInit) {
  return sharedSafeFetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), ...init });
}

function pushMissingHeader(findings: Finding[], headers: Headers, header: string, title: string, severity: Finding["severity"], recommendation: string) {
  if (!headers.has(header)) {
    findings.push({ category: "missing_headers", severity, title, description: `The response has no ${header} header.`, recommendation });
  }
}

function checkSecurityHeaders(headers: Headers): Finding[] {
  const findings: Finding[] = [];
  pushMissingHeader(findings, headers, "content-security-policy", "Missing Content-Security-Policy", "medium", "Add a Content-Security-Policy header to restrict script/style/frame sources and reduce XSS impact.");
  pushMissingHeader(findings, headers, "x-frame-options", "Missing X-Frame-Options", "medium", "Add X-Frame-Options: DENY or SAMEORIGIN to prevent clickjacking via iframes.");
  pushMissingHeader(findings, headers, "x-content-type-options", "Missing X-Content-Type-Options", "low", "Add X-Content-Type-Options: nosniff to stop MIME-sniffing attacks.");
  pushMissingHeader(findings, headers, "referrer-policy", "Missing Referrer-Policy", "low", "Add a Referrer-Policy header to control how much referrer data leaks to other sites.");
  pushMissingHeader(findings, headers, "permissions-policy", "Missing Permissions-Policy", "low", "Add a Permissions-Policy header to restrict access to browser features (camera, geolocation, etc).");
  pushMissingHeader(findings, headers, "strict-transport-security", "Missing HSTS (Strict-Transport-Security)", "medium", "Add Strict-Transport-Security with a long max-age so browsers always use HTTPS for this site.");
  return findings;
}

// CSP presence alone (checkSecurityHeaders above) says nothing about whether the policy is
// actually effective - a default-src * or script-src with unsafe-inline/unsafe-eval provides
// little real XSS mitigation despite the header being present. Parses the directive values
// directly rather than just checking for the header's existence.
function checkCspQuality(headers: Headers): Finding[] {
  const findings: Finding[] = [];
  const csp = headers.get("content-security-policy");
  if (!csp) return findings;

  const directives = new Map<string, string>();
  for (const part of csp.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const spaceIdx = trimmed.indexOf(" ");
    const name = (spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)).toLowerCase();
    directives.set(name, spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1));
  }

  const scriptSrc = directives.get("script-src") ?? directives.get("default-src") ?? "";
  if (/unsafe-inline/.test(scriptSrc)) {
    findings.push({
      category: "weak_csp",
      severity: "medium",
      title: "CSP allows 'unsafe-inline' for scripts",
      evidence: csp.length > 300 ? csp.slice(0, 300) + "..." : csp,
      recommendation: "Remove 'unsafe-inline' from script-src and use nonces/hashes for any inline scripts that are genuinely needed.",
    });
  }
  if (/unsafe-eval/.test(scriptSrc)) {
    findings.push({
      category: "weak_csp",
      severity: "medium",
      title: "CSP allows 'unsafe-eval' for scripts",
      evidence: csp.length > 300 ? csp.slice(0, 300) + "..." : csp,
      recommendation: "Remove 'unsafe-eval' from script-src - it allows eval()/Function()-style dynamic code execution, a common XSS escalation path.",
    });
  }
  if (/(^|\s)\*(\s|$)/.test(scriptSrc) || (directives.has("default-src") && /(^|\s)\*(\s|$)/.test(directives.get("default-src")!) && !directives.has("script-src"))) {
    findings.push({
      category: "weak_csp",
      severity: "medium",
      title: "CSP allows scripts from any origin (wildcard *)",
      evidence: csp.length > 300 ? csp.slice(0, 300) + "..." : csp,
      recommendation: "Replace the wildcard with an explicit allow-list of script sources actually used by the site.",
    });
  }
  if (!directives.has("default-src") && !directives.has("script-src")) {
    findings.push({
      category: "weak_csp",
      severity: "low",
      title: "CSP has no default-src or script-src directive",
      evidence: csp.length > 300 ? csp.slice(0, 300) + "..." : csp,
      recommendation: "Add a default-src (or at least script-src) directive - without one, script-source restriction isn't actually being enforced.",
    });
  }
  return findings;
}

// HSTS presence alone (checkSecurityHeaders above) doesn't catch a token max-age (e.g. a few
// seconds/minutes, which offers negligible real protection) or a policy that forgot
// includeSubDomains, leaving subdomains free to be attacked to pivot back to the main domain.
const HSTS_MIN_RECOMMENDED_MAX_AGE = 15552000; // 180 days - a commonly-cited practical minimum (HSTS preload lists require 1 year, but 180 days is a reasonable floor before flagging)

function checkHstsQuality(headers: Headers, isHttps: boolean): Finding[] {
  const findings: Finding[] = [];
  if (!isHttps) return findings;
  const hsts = headers.get("strict-transport-security");
  if (!hsts) return findings; // already flagged as fully missing by checkSecurityHeaders

  const maxAgeMatch = /max-age=(\d+)/i.exec(hsts);
  const maxAge = maxAgeMatch ? Number(maxAgeMatch[1]) : 0;
  if (maxAge < HSTS_MIN_RECOMMENDED_MAX_AGE) {
    findings.push({
      category: "weak_hsts",
      severity: "low",
      title: `HSTS max-age is too short (${maxAge}s)`,
      evidence: hsts,
      recommendation: `Set max-age to at least ${HSTS_MIN_RECOMMENDED_MAX_AGE} seconds (180 days); 31536000 (1 year) is required for HSTS preload list submission.`,
    });
  }
  if (!/includesubdomains/i.test(hsts)) {
    findings.push({
      category: "weak_hsts",
      severity: "low",
      title: "HSTS does not include includeSubDomains",
      evidence: hsts,
      recommendation: "Add includeSubDomains so an attacker can't bypass HSTS protection via an unprotected subdomain.",
    });
  }
  return findings;
}

// Cross-origin <script> tags with no `integrity` attribute can't be verified by the browser -
// if the third-party host serving the script is ever compromised, the attacker's code runs on
// this site with no detection. Same-origin scripts are excluded (SRI protects against a
// compromised THIRD PARTY, not your own server, and self-hosted scripts can't practically use
// SRI anyway since they change on every deploy).
function checkSubresourceIntegrity(html: string, pageUrl: string): Finding[] {
  const findings: Finding[] = [];
  let pageOrigin: string;
  try {
    pageOrigin = new URL(pageUrl).origin;
  } catch {
    return findings;
  }
  const scriptTags = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)];
  const missingIntegrity: string[] = [];
  for (const [fullTag, src] of scriptTags) {
    if (!/^https?:\/\//i.test(src)) continue; // relative/same-origin by construction
    try {
      if (new URL(src).origin === pageOrigin) continue; // same-origin, SRI not the relevant control here
    } catch {
      continue;
    }
    if (!/\bintegrity=/i.test(fullTag)) missingIntegrity.push(src);
  }
  if (missingIntegrity.length > 0) {
    findings.push({
      category: "missing_sri",
      severity: "low",
      title: `${missingIntegrity.length} cross-origin script(s) loaded without Subresource Integrity`,
      evidence: missingIntegrity.slice(0, 5).join("\n"),
      recommendation: "Add an integrity attribute (and crossorigin=\"anonymous\") to every cross-origin <script> tag so the browser refuses to run the script if it's ever tampered with at the source.",
    });
  }
  return findings;
}

// Cheap, passive, same existence-check-only pattern as checkExposedPaths - these are common
// upload/asset directories that web servers sometimes leave autoindex-enabled on by default.
const DIRECTORY_LISTING_CANDIDATES = ["/uploads/", "/images/", "/assets/", "/files/", "/backup/", "/backups/", "/static/", "/media/"];
const DIRECTORY_LISTING_SIGNATURE = /<title>\s*index of \/|<h1>\s*index of \//i;

async function checkDirectoryListing(baseUrl: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const u = new URL(baseUrl);
  const results = await Promise.allSettled(
    DIRECTORY_LISTING_CANDIDATES.map(async (path) => {
      const res = await safeFetch(`${u.origin}${path}`, { method: "GET" });
      if (res.status !== 200) return null;
      const body = await res.text().catch(() => "");
      return DIRECTORY_LISTING_SIGNATURE.test(body) ? path : null;
    })
  );
  const exposed = results.filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled" && r.value !== null).map((r) => r.value);
  if (exposed.length > 0) {
    findings.push({
      category: "directory_listing_enabled",
      severity: "medium",
      title: `Directory listing enabled: ${exposed.join(", ")}`,
      description: "These paths return an autoindex-style file listing instead of a normal page or a 403/404, exposing every file in the directory to anyone.",
      recommendation: "Disable directory autoindexing at the web server level (e.g. Options -Indexes in Apache, autoindex off; in nginx) for directories that don't need it.",
    });
  }
  return findings;
}

function checkCookies(headers: Headers): Finding[] {
  const findings: Finding[] = [];
  const setCookie = headers.get("set-cookie");
  if (!setCookie) return findings;
  const cookies = setCookie.split(/,(?=[^;]+?=)/).map((c) => c.trim());
  for (const cookie of cookies) {
    const name = cookie.split("=")[0];
    const lower = cookie.toLowerCase();
    const missing: string[] = [];
    if (!lower.includes("secure")) missing.push("Secure");
    if (!lower.includes("httponly")) missing.push("HttpOnly");
    if (!lower.includes("samesite")) missing.push("SameSite");
    if (missing.length > 0) {
      findings.push({
        category: "insecure_cookies",
        severity: missing.includes("HttpOnly") ? "high" : "medium",
        title: `Cookie "${name}" missing ${missing.join(", ")}`,
        evidence: cookie.length > 200 ? cookie.slice(0, 200) + "..." : cookie,
        recommendation: "Set the Secure, HttpOnly, and SameSite flags on all cookies that don't need client-side script access.",
      });
    }
  }
  return findings;
}

async function checkCors(url: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  try {
    const res = await safeFetch(url, { headers: { "User-Agent": UA, Origin: "https://security-audit-probe.invalid" } });
    const allowOrigin = res.headers.get("access-control-allow-origin");
    const allowCreds = res.headers.get("access-control-allow-credentials");
    if (allowOrigin === "*" && allowCreds === "true") {
      findings.push({
        category: "cors_misconfiguration",
        severity: "high",
        title: "CORS allows any origin with credentials",
        description: "Access-Control-Allow-Origin: * combined with Access-Control-Allow-Credentials: true lets any site read authenticated responses.",
        recommendation: "Restrict Access-Control-Allow-Origin to a known allow-list when credentials are involved.",
      });
    } else if (allowOrigin && allowOrigin !== "*" && allowOrigin.includes("security-audit-probe.invalid")) {
      findings.push({
        category: "cors_misconfiguration",
        severity: "high",
        title: "CORS reflects arbitrary Origin header",
        description: "The server echoed back an unrecognized Origin value, suggesting it reflects any origin rather than checking an allow-list.",
        recommendation: "Validate Origin against a fixed allow-list instead of reflecting the request's Origin header.",
      });
    }
  } catch {
    // network error — skip, not a finding
  }
  return findings;
}

async function checkHttpMethods(url: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  try {
    const res = await safeFetch(url, { method: "OPTIONS" });
    const allow = (res.headers.get("allow") ?? "").toUpperCase();
    const risky = ["TRACE", "PUT", "DELETE", "CONNECT"].filter((m) => allow.includes(m));
    if (risky.length > 0) {
      findings.push({
        category: "insecure_http_methods",
        severity: "medium",
        title: `Potentially risky HTTP methods enabled: ${risky.join(", ")}`,
        evidence: `Allow: ${allow}`,
        recommendation: "Disable HTTP methods not required by the application (especially TRACE, PUT, DELETE) at the web server level.",
      });
    }
  } catch {
    // some servers reject OPTIONS outright — not itself a finding
  }
  return findings;
}

// Explicit active confirmation (now authorized, since this scanner only ever runs against
// the site owner's own properties): a single benign PUT/DELETE with no body against a path
// that can't correspond to any real resource. Only flags something if the server actually
// accepts a write method on an arbitrary path — never touches a real endpoint.
async function checkWriteMethodsEnabled(baseUrl: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const u = new URL(baseUrl);
  const probePath = `${u.origin}/__lm_security_scan_method_probe__`;
  for (const method of ["PUT", "DELETE"] as const) {
    try {
      const res = await safeFetch(probePath, { method });
      if (res.status >= 200 && res.status < 300) {
        findings.push({
          category: "insecure_http_methods",
          severity: "high",
          title: `${method} method appears to succeed on an arbitrary, nonexistent path`,
          affectedUrl: probePath,
          httpMethod: method,
          confidence: "Confirmed",
          evidence: `HTTP ${method} ${probePath} returned ${res.status}.`,
          recommendation: `Disable the ${method} method at the web server level unless the application specifically requires it, and ensure it's properly access-controlled if needed.`,
        });
      }
    } catch {
      // network error / method rejected outright — not a finding
    }
  }
  return findings;
}

export interface ExtendedHeaderInfo {
  crossOriginOpenerPolicy: string | null;
  crossOriginEmbedderPolicy: string | null;
  crossOriginResourcePolicy: string | null;
  expectCt: string | null;
  cacheControl: string | null;
  pragma: string | null;
  server: string | null;
  poweredBy: string | null;
}

function readExtendedHeaders(headers: Headers): ExtendedHeaderInfo {
  return {
    crossOriginOpenerPolicy: headers.get("cross-origin-opener-policy"),
    crossOriginEmbedderPolicy: headers.get("cross-origin-embedder-policy"),
    crossOriginResourcePolicy: headers.get("cross-origin-resource-policy"),
    expectCt: headers.get("expect-ct"),
    cacheControl: headers.get("cache-control"),
    pragma: headers.get("pragma"),
    server: headers.get("server"),
    poweredBy: headers.get("x-powered-by"),
  };
}

async function checkHttpsRedirect(url: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const u = new URL(url);
  if (u.protocol !== "https:") return findings;
  try {
    const httpUrl = `http://${u.host}${u.pathname}`;
    const res = await safeFetch(httpUrl);
    const location = res.headers.get("location") ?? "";
    const redirectsToHttps = res.status >= 300 && res.status < 400 && location.startsWith("https://");
    if (!redirectsToHttps) {
      findings.push({
        category: "missing_https_redirect",
        severity: "medium",
        title: "Plain HTTP does not redirect to HTTPS",
        description: `http://${u.host} responded ${res.status} instead of redirecting to https://.`,
        recommendation: "Add a server-level redirect from HTTP to HTTPS for every path.",
      });
    }
  } catch {
    // http:// port may simply be closed, which is fine — not a finding
  }
  return findings;
}

function checkMixedContent(html: string, pageUrl: string): Finding[] {
  const findings: Finding[] = [];
  if (!pageUrl.startsWith("https://")) return findings;
  const matches = [...html.matchAll(/(?:src|href)=["']http:\/\/[^"']+["']/gi)].map((m) => m[0]);
  if (matches.length > 0) {
    findings.push({
      category: "mixed_content",
      severity: "medium",
      title: `${matches.length} insecure (http://) resource reference(s) on an HTTPS page`,
      evidence: matches.slice(0, 5).join("\n"),
      recommendation: "Serve all page resources (scripts, styles, images) over HTTPS to avoid mixed-content warnings/blocking.",
    });
  }
  return findings;
}

// Sites with client-side routing (Next.js/SPA) or a custom catch-all page often return
// HTTP 200 for literally any unknown path instead of a real 404 - which previously made
// every single path in SENSITIVE_PATHS "found" at once (confirmed live: one Next.js site
// flagged all 14 as publicly reachable simultaneously, each actually the site's own
// fallback page, zeroing its score). This probes one definitely-nonexistent path first and
// only trusts a candidate 200 when its response looks genuinely different from that
// baseline - only the byte length is ever compared, the body's content is never read.
async function getSoft404Baseline(origin: string): Promise<{ status: number; length: number | null }> {
  const probePath = `/__lm-scan-baseline-${Math.random().toString(36).slice(2)}__`;
  try {
    const res = await safeFetch(`${origin}${probePath}`, { method: "GET" });
    const body = await res.text().catch(() => "");
    return { status: res.status, length: body.length };
  } catch {
    return { status: 0, length: null };
  }
}

async function checkExposedPaths(baseUrl: string, paths: string[], category: string, severity: Finding["severity"], label: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const u = new URL(baseUrl);
  const baseline = await getSoft404Baseline(u.origin);
  const results = await Promise.allSettled(
    paths.map(async (p) => {
      const res = await safeFetch(`${u.origin}${p}`, { method: "GET" });
      const body = await res.text().catch(() => "");
      return { path: p, status: res.status, length: body.length };
    })
  );
  for (const r of results) {
    if (r.status !== "fulfilled" || r.value.status !== 200) continue;
    const { path, length } = r.value;
    // A catch-all shell page isn't byte-for-byte identical on every path (confirmed live on
    // websearchpro.net: 11995-12072 bytes across different paths, same page, ~12KB total) -
    // an exact/near-exact length match was too strict and let every false positive through.
    // Real distinct content (an actual exposed .env/.git/backup file) differs far more than
    // a few dozen bytes of templated head-tag variation, so a generous tolerance here still
    // comfortably separates "same fallback page" from "something genuinely different."
    if (baseline.status === 200 && baseline.length !== null) {
      const diff = Math.abs(length - baseline.length);
      const relativeDiff = diff / Math.max(baseline.length, 1);
      if (diff <= 300 || relativeDiff <= 0.05) continue;
    }
    findings.push({
      category,
      severity,
      title: `${label}: ${path}`,
      description: `A request to ${path} returned HTTP 200 (${length} bytes), distinct from this site's default response for unknown paths.`,
      recommendation: "Remove or restrict access to this path; it should not be publicly reachable.",
    });
  }

  // Caps how many of these actually count toward the score - without this, a single
  // systematic false-positive cause (e.g. the soft-404 baseline heuristic above glitching on
  // one site's unusual fallback-page behavior) could swing the whole score by 60-100+ points
  // through this one category alone, since every path in SENSITIVE_PATHS/ADMIN_API_PATHS is
  // "critical"/"info" severity independently. Every exposed path is still reported
  // individually for remediation visibility - only the scoring impact is bounded.
  const MAX_SCORED_PER_CATEGORY = 2;
  if (findings.length > MAX_SCORED_PER_CATEGORY) {
    for (let i = MAX_SCORED_PER_CATEGORY; i < findings.length; i++) {
      findings[i] = {
        ...findings[i],
        severity: "info",
        description: `${findings[i].description} (Not counted toward the score — capped at ${MAX_SCORED_PER_CATEGORY} scored findings per category so one systematic detection issue can't dominate the overall score; still reported here for visibility.)`,
      };
    }
  }

  return findings;
}

function checkDebugAndErrors(html: string, status: number): Finding[] {
  const findings: Finding[] = [];
  const patterns: [RegExp, string][] = [
    [/whoops[,!]? looks like something went wrong/i, "Laravel debug page (Whoops) detected"],
    [/django.*debug.*=.*true|technical difficulties.*django/i, "Django DEBUG mode indicator detected"],
    [/stack trace:|at\s+\S+\.\w+\s*\(.*:\d+:\d+\)/i, "Stack trace exposed in response"],
    [/fatal error:.*on line \d+/i, "PHP fatal error with file/line exposed"],
    [/System\.Exception|StackTrace:\s*at /i, ".NET exception/stack trace exposed"],
  ];
  for (const [re, title] of patterns) {
    if (re.test(html)) {
      findings.push({
        category: "debug_exposure",
        severity: "high",
        title,
        recommendation: "Disable debug/verbose error output in production; show a generic error page instead.",
      });
    }
  }
  if (status >= 500) {
    findings.push({
      category: "debug_exposure",
      severity: "low",
      title: `Server returned a ${status} error on a routine request`,
      recommendation: "Investigate why the homepage/base URL returns a server error.",
    });
  }
  return findings;
}

function checkOpenRedirectIndicators(html: string): Finding[] {
  const findings: Finding[] = [];
  const matches = [...html.matchAll(/href=["'][^"']*[?&](redirect|next|url|return|dest|continue)=/gi)];
  if (matches.length > 0) {
    findings.push({
      category: "open_redirect_risk",
      severity: "low",
      title: `${matches.length} link(s) use a redirect-style query parameter`,
      description: "This is a heuristic indicator only — it means the pattern exists in links, not that an open redirect was confirmed.",
      recommendation: "Manually verify that any redirect/next/url parameter validates the destination against an allow-list before redirecting.",
    });
  }
  return findings;
}

const LOGIN_PATHS = ["/login", "/signin", "/wp-login.php", "/admin/login", "/account/login"];
const LOGOUT_HINT = /logout|sign[\s-]?out/i;
const MFA_HINT = /two[\s-]?factor|2fa|otp|authenticator|verification code/i;

// Section 7 (Authentication Security) — all passive/heuristic or single safe GETs against
// a handful of common login paths. Never submits credentials or any form data.
async function checkAuthSignals(baseUrl: string, homepageHtml: string, cookieHeader: string | null): Promise<Finding[]> {
  const findings: Finding[] = [];
  const u = new URL(baseUrl);

  if (cookieHeader) {
    const cookies = cookieHeader.split(/,(?=[^;]+?=)/).map((c) => c.trim());
    for (const cookie of cookies) {
      const name = cookie.split("=")[0];
      if (!/session|sid|auth|token/i.test(name)) continue;
      const lower = cookie.toLowerCase();
      const missing = ["secure", "httponly"].filter((flag) => !lower.includes(flag)).map((f) => (f === "httponly" ? "HttpOnly" : "Secure"));
      if (missing.length > 0) {
        findings.push({
          category: "auth_session_cookie_exposed",
          severity: "high",
          title: `Session-like cookie "${name}" missing ${missing.join(", ")}`,
          evidence: cookie.length > 200 ? cookie.slice(0, 200) + "..." : cookie,
          recommendation: "Set Secure and HttpOnly on every session-identifying cookie.",
        });
      }
    }
  }

  const forms = [...homepageHtml.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/gi)];
  const hasCsrfToken = (body: string) => /(csrf|_token|authenticity_token|__requestverificationtoken)/i.test(body);
  if (forms.length > 0 && forms.every((m) => !hasCsrfToken(m[1]))) {
    findings.push({
      category: "auth_csrf_token_missing",
      severity: "medium",
      title: "No hidden CSRF token field found in homepage forms",
      confidence: "Tentative",
      description: "Static-HTML heuristic only — does not rule out header-based or SameSite-cookie-based CSRF protection.",
      recommendation: "Confirm CSRF protection is present (token, double-submit cookie, or strict SameSite) for all state-changing forms.",
    });
  }

  if (!LOGOUT_HINT.test(homepageHtml)) {
    findings.push({
      category: "auth_no_logout_found",
      severity: "info",
      title: "No logout link found on homepage",
      confidence: "Tentative",
      description: "Heuristic only — logout controls are typically only visible after authentication, which this scanner does not perform.",
    });
  }

  // Probed in parallel, not one-at-a-time - sequentially, 5 candidate paths at up to 15s
  // timeout each is a 75s worst case on this single check alone. Semantics are unchanged
  // (first LOGIN_PATHS entry with a password field wins); only the timing changed.
  const loginProbeResults = await Promise.allSettled(
    LOGIN_PATHS.map(async (path) => {
      const res = await safeFetch(`${u.origin}${path}`);
      if (res.status !== 200) return null;
      const html = await res.text();
      if (!/<input[^>]+type=["']password["']/i.test(html)) return null;
      return { path, html };
    })
  );
  const firstMatch = LOGIN_PATHS.map((_, i) => loginProbeResults[i])
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .find((v): v is { path: string; html: string } => v !== null);
  if (firstMatch) {
    findings.push({
      category: "auth_login_page_detected",
      severity: "info",
      title: `Login page found at ${firstMatch.path}`,
      affectedUrl: `${u.origin}${firstMatch.path}`,
    });
    if (!MFA_HINT.test(firstMatch.html)) {
      findings.push({
        category: "auth_no_mfa_indicator",
        severity: "low",
        title: "No MFA/2FA indicator found on login page",
        confidence: "Tentative",
        affectedUrl: `${u.origin}${firstMatch.path}`,
        description: "Heuristic keyword check only — does not confirm MFA is truly unavailable.",
      });
    }
  }

  return findings;
}

export interface HttpCheckContext {
  html: string;
  headers: Headers;
  status: number;
  extendedHeaders: ExtendedHeaderInfo;
}

export async function runHttpChecks(url: string): Promise<{ findings: Finding[]; context: HttpCheckContext }> {
  const res = await sharedSafeFetch(url, { redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  const html = await res.text();
  const context: HttpCheckContext = { html, headers: res.headers, status: res.status, extendedHeaders: readExtendedHeaders(res.headers) };

  const [cors, methods, writeMethods, httpsRedirect, sensitivePaths, adminPaths, authSignals, directoryListing] = await Promise.all([
    checkCors(url),
    checkHttpMethods(url),
    checkWriteMethodsEnabled(url),
    checkHttpsRedirect(url),
    checkExposedPaths(url, SENSITIVE_PATHS, "exposed_sensitive_files", "critical", "Sensitive file publicly reachable"),
    checkExposedPaths(url, ADMIN_API_PATHS, "exposed_admin_api", "info", "Common admin/API path reachable (may be expected)"),
    checkAuthSignals(url, html, res.headers.get("set-cookie")),
    checkDirectoryListing(url),
  ]);

  const findings: Finding[] = [
    ...checkSecurityHeaders(res.headers),
    ...checkCspQuality(res.headers),
    ...checkHstsQuality(res.headers, url.startsWith("https://")),
    ...checkCookies(res.headers),
    ...cors,
    ...methods,
    ...writeMethods,
    ...httpsRedirect,
    ...checkMixedContent(html, res.url),
    ...checkSubresourceIntegrity(html, res.url),
    ...checkDebugAndErrors(html, res.status),
    ...checkOpenRedirectIndicators(html),
    ...sensitivePaths,
    ...adminPaths,
    ...authSignals,
    ...directoryListing,
  ];

  return { findings, context };
}
