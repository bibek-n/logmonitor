import type { Finding } from "./types";

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
  return fetch(url, { redirect: "manual", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { "User-Agent": UA }, ...init });
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

async function checkExposedPaths(baseUrl: string, paths: string[], category: string, severity: Finding["severity"], label: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const u = new URL(baseUrl);
  const results = await Promise.allSettled(
    paths.map(async (p) => {
      const res = await safeFetch(`${u.origin}${p}`, { method: "GET" });
      return { path: p, status: res.status };
    })
  );
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.status === 200) {
      findings.push({
        category,
        severity,
        title: `${label}: ${r.value.path}`,
        description: `A request to ${r.value.path} returned HTTP 200.`,
        recommendation: "Remove or restrict access to this path; it should not be publicly reachable.",
      });
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

  for (const path of LOGIN_PATHS) {
    try {
      const res = await safeFetch(`${u.origin}${path}`);
      if (res.status !== 200) continue;
      const html = await res.text();
      if (!/<input[^>]+type=["']password["']/i.test(html)) continue;
      findings.push({
        category: "auth_login_page_detected",
        severity: "info",
        title: `Login page found at ${path}`,
        affectedUrl: `${u.origin}${path}`,
      });
      if (!MFA_HINT.test(html)) {
        findings.push({
          category: "auth_no_mfa_indicator",
          severity: "low",
          title: "No MFA/2FA indicator found on login page",
          confidence: "Tentative",
          affectedUrl: `${u.origin}${path}`,
          description: "Heuristic keyword check only — does not confirm MFA is truly unavailable.",
        });
      }
      break;
    } catch {
      // path unreachable — try the next candidate
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
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { "User-Agent": UA } });
  const html = await res.text();
  const context: HttpCheckContext = { html, headers: res.headers, status: res.status, extendedHeaders: readExtendedHeaders(res.headers) };

  const [cors, methods, writeMethods, httpsRedirect, sensitivePaths, adminPaths, authSignals] = await Promise.all([
    checkCors(url),
    checkHttpMethods(url),
    checkWriteMethodsEnabled(url),
    checkHttpsRedirect(url),
    checkExposedPaths(url, SENSITIVE_PATHS, "exposed_sensitive_files", "critical", "Sensitive file publicly reachable"),
    checkExposedPaths(url, ADMIN_API_PATHS, "exposed_admin_api", "info", "Common admin/API path reachable (may be expected)"),
    checkAuthSignals(url, html, res.headers.get("set-cookie")),
  ]);

  const findings: Finding[] = [
    ...checkSecurityHeaders(res.headers),
    ...checkCookies(res.headers),
    ...cors,
    ...methods,
    ...writeMethods,
    ...httpsRedirect,
    ...checkMixedContent(html, res.url),
    ...checkDebugAndErrors(html, res.status),
    ...checkOpenRedirectIndicators(html),
    ...sensitivePaths,
    ...adminPaths,
    ...authSignals,
  ];

  return { findings, context };
}
