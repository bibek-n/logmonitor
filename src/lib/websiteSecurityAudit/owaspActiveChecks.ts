import type { CodeFinding, Finding } from "./types";

const UA = "LogMonitor-WebsiteSecurityAudit/1.0 (+authorized-scan)";
const FETCH_TIMEOUT_MS = 15000;
const MAX_CRAWL_PAGES = 15;
const MAX_TOTAL_REQUESTS = 30;

interface DiscoveredParam {
  pageUrl: string;
  paramName: string;
  paramValue: string;
}

interface DiscoveredForm {
  pageUrl: string;
  action: string;
  hasFileUpload: boolean;
  fields: string[];
}

async function safeFetch(url: string, init?: RequestInit) {
  return fetch(url, { redirect: "manual", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { "User-Agent": UA }, ...init });
}

function extractSameOriginLinks(html: string, baseUrl: string, limit: number): string[] {
  const origin = new URL(baseUrl).origin;
  const links = new Set<string>();
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    try {
      const resolved = new URL(m[1], baseUrl);
      if (resolved.origin === origin && !/\.(png|jpe?g|gif|svg|css|js|ico|woff2?|pdf|zip)$/i.test(resolved.pathname)) {
        links.add(resolved.toString());
      }
    } catch {
      // relative/malformed href — skip
    }
    if (links.size >= limit) break;
  }
  return [...links];
}

function extractQueryParams(pageUrl: string): DiscoveredParam[] {
  try {
    const u = new URL(pageUrl);
    const params: DiscoveredParam[] = [];
    u.searchParams.forEach((value, name) => params.push({ pageUrl, paramName: name, paramValue: value }));
    return params;
  } catch {
    return [];
  }
}

function extractForms(html: string, pageUrl: string): DiscoveredForm[] {
  const forms: DiscoveredForm[] = [];
  for (const formMatch of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
    const attrs = formMatch[1];
    const body = formMatch[2];
    const action = /action=["']([^"']*)["']/i.exec(attrs)?.[1] ?? pageUrl;
    const fields = [...body.matchAll(/<input\b([^>]*)>/gi)]
      .map((m) => /name=["']([^"']*)["']/i.exec(m[1])?.[1])
      .filter((v): v is string => !!v);
    const hasFileUpload = /<input[^>]+type=["']file["']/i.test(body);
    forms.push({ pageUrl, action, hasFileUpload, fields });
  }
  return forms;
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

// --- Active safe probes: each sends exactly one benign request whose only purpose is
// observing a response (reflection, error message, redirect header) — never a payload that
// could execute, modify data, or persist anything. ---

async function probeReflectedXss(param: DiscoveredParam): Promise<Finding | null> {
  const canary = `lmxss${Math.abs(hashCode(param.pageUrl + param.paramName)).toString(36)}`;
  const marker = `"><${canary}>`;
  try {
    const u = new URL(param.pageUrl);
    u.searchParams.set(param.paramName, marker);
    const res = await safeFetch(u.toString());
    const body = await res.text();
    if (body.includes(marker)) {
      return {
        category: "owasp_reflected_xss",
        severity: "high",
        title: `Reflected XSS indicator on parameter "${param.paramName}"`,
        affectedUrl: param.pageUrl,
        parameter: param.paramName,
        httpMethod: "GET",
        confidence: "Firm",
        evidence: `Canary value ${marker} was reflected unescaped in the response body — never executed, only observed.`,
        recommendation: "HTML-encode all user-controlled output before rendering it, and validate/allow-list input on this parameter.",
      };
    }
  } catch {
    // network error — not a finding
  }
  return null;
}

const SQL_ERROR_SIGNATURES = [
  /you have an error in your sql syntax/i,
  /warning: mysqli?_/i,
  /unclosed quotation mark after the character string/i,
  /quoted string not properly terminated/i,
  /pg_query\(\)|postgresql.*error/i,
  /sqlite3?::/i,
  /ORA-\d{5}/,
  /System\.Data\.SqlClient\.SqlException/i,
];

async function probeSqlErrorIndicator(param: DiscoveredParam): Promise<Finding | null> {
  try {
    const u = new URL(param.pageUrl);
    u.searchParams.set(param.paramName, `${param.paramValue}'`);
    const res = await safeFetch(u.toString());
    const body = await res.text();
    const matched = SQL_ERROR_SIGNATURES.some((re) => re.test(body));
    if (matched) {
      return {
        category: "owasp_sql_injection_indicator",
        severity: "high",
        title: `Possible SQL injection indicator on parameter "${param.paramName}"`,
        affectedUrl: param.pageUrl,
        parameter: param.paramName,
        httpMethod: "GET",
        confidence: "Tentative",
        evidence: "A database error signature appeared after appending a single quote to this parameter's value — no data was read, modified, or extracted.",
        recommendation: "Use parameterized queries/prepared statements for all database access involving this parameter; verify manually before treating this as confirmed.",
      };
    }
  } catch {
    // network error — not a finding
  }
  return null;
}

const REDIRECT_PARAM_NAMES = /^(url|redirect|redirect_uri|next|return|returnurl|dest|destination|continue|go|target)$/i;
const REDIRECT_CANARY = "https://logmonitor-redirect-check.invalid/probe";

async function probeOpenRedirect(param: DiscoveredParam): Promise<Finding | null> {
  if (!REDIRECT_PARAM_NAMES.test(param.paramName)) return null;
  try {
    const u = new URL(param.pageUrl);
    u.searchParams.set(param.paramName, REDIRECT_CANARY);
    const res = await safeFetch(u.toString());
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location && location.startsWith(REDIRECT_CANARY)) {
      return {
        category: "owasp_open_redirect",
        severity: "medium",
        title: `Open redirect confirmed on parameter "${param.paramName}"`,
        affectedUrl: param.pageUrl,
        parameter: param.paramName,
        httpMethod: "GET",
        confidence: "Firm",
        evidence: `Location header echoed the test URL unmodified (never followed): ${location}`,
        recommendation: "Validate any redirect-target parameter against an allow-list of known-safe destinations before issuing a redirect.",
      };
    }
  } catch {
    // network error — not a finding
  }
  return null;
}

// --- Heuristic-only, confidence-capped categories. Per the user's explicit decision, these
// always appear in the report — with either an observed indicator or an honest "no
// indicators observed" line — because this scanner has no out-of-band callback
// infrastructure and no authenticated app context to test them properly. ---

function makeHeuristic(category: string, signalFound: boolean, affectedUrl: string, parameter: string | undefined, note: string): Finding {
  return {
    category,
    severity: signalFound ? "medium" : "info",
    title: signalFound ? "Possible indicator observed (heuristic-only, requires manual verification)" : "No indicators observed (heuristic-only check)",
    confidence: "Tentative",
    affectedUrl,
    parameter,
    description: `${note} This scanner does not send exploit payloads or use out-of-band/authenticated testing for this category — treat any "indicator observed" result as a lead for manual review, not a confirmed vulnerability.`,
  };
}

function heuristicNotes(params: DiscoveredParam[], forms: DiscoveredForm[], baseUrl: string): Finding[] {
  const findings: Finding[] = [];

  const urlShaped = params.filter((p) => /^https?:\/\//i.test(p.paramValue) || /url|uri|link|src|fetch|callback/i.test(p.paramName));
  findings.push(
    makeHeuristic(
      "owasp_ssrf_heuristic",
      urlShaped.length > 0,
      urlShaped[0]?.pageUrl ?? baseUrl,
      urlShaped[0]?.paramName,
      urlShaped.length > 0
        ? `Found ${urlShaped.length} URL-shaped parameter(s) that could theoretically trigger a server-side fetch.`
        : "No URL-shaped parameters were observed during this scan's limited crawl."
    )
  );

  const xmlForms = forms.filter((f) => f.fields.some((field) => /xml/i.test(field)));
  findings.push(
    makeHeuristic(
      "owasp_xxe_heuristic",
      xmlForms.length > 0,
      xmlForms[0]?.pageUrl ?? baseUrl,
      undefined,
      xmlForms.length > 0
        ? "Found form field(s) suggesting XML input may be accepted."
        : "No indicators of an XML-accepting endpoint were observed during this scan's limited crawl."
    )
  );

  const cmdShaped = params.filter((p) => /^(cmd|command|exec|run|ping|host|ip)$/i.test(p.paramName));
  findings.push(
    makeHeuristic(
      "owasp_command_injection_heuristic",
      cmdShaped.length > 0,
      cmdShaped[0]?.pageUrl ?? baseUrl,
      cmdShaped[0]?.paramName,
      cmdShaped.length > 0
        ? `Found parameter name(s) suggestive of a system command being invoked (${cmdShaped.map((p) => p.paramName).join(", ")}).`
        : "No command-shaped parameter names were observed during this scan's limited crawl."
    )
  );

  const templateShaped = params.filter((p) => /\{\{|\$\{|<%/.test(p.paramValue));
  findings.push(
    makeHeuristic(
      "owasp_ssti_heuristic",
      templateShaped.length > 0,
      templateShaped[0]?.pageUrl ?? baseUrl,
      templateShaped[0]?.paramName,
      templateShaped.length > 0
        ? "Found parameter value(s) already containing template-like syntax."
        : "No template-syntax-shaped parameter values were observed during this scan's limited crawl."
    )
  );

  const fileShaped = params.filter((p) => /^(file|path|page|template|include|doc|document)$/i.test(p.paramName));
  findings.push(
    makeHeuristic(
      "owasp_lfi_rfi_heuristic",
      fileShaped.length > 0,
      fileShaped[0]?.pageUrl ?? baseUrl,
      fileShaped[0]?.paramName,
      fileShaped.length > 0
        ? `Found file/path-shaped parameter name(s) (${fileShaped.map((p) => p.paramName).join(", ")}).`
        : "No file/path-shaped parameter names were observed during this scan's limited crawl."
    )
  );

  const idShaped = params.filter((p) => /^(id|user_id|userid|account|order|invoice|doc_id)$/i.test(p.paramName) && /^\d+$/.test(p.paramValue));
  findings.push(
    makeHeuristic(
      "owasp_idor_heuristic",
      idShaped.length > 0,
      idShaped[0]?.pageUrl ?? baseUrl,
      idShaped[0]?.paramName,
      idShaped.length > 0
        ? `Found numeric ID-shaped parameter(s) (${idShaped.map((p) => p.paramName).join(", ")}) that could be tested for ownership-check bypass.`
        : "No numeric ID-shaped parameters were observed during this scan's limited crawl."
    )
  );

  const adminLikeReachable = forms.some((f) => /admin|dashboard|manage/i.test(f.action));
  findings.push(
    makeHeuristic(
      "owasp_broken_access_control_heuristic",
      adminLikeReachable,
      baseUrl,
      undefined,
      adminLikeReachable
        ? "Found a form pointing at an admin/management-looking path reachable without an authentication challenge."
        : "No admin/management-looking forms were observed reachable without authentication during this scan's limited crawl."
    )
  );

  const uploadForms = forms.filter((f) => f.hasFileUpload);
  findings.push(
    makeHeuristic(
      "owasp_insecure_deserialization_heuristic",
      uploadForms.length > 0,
      uploadForms[0]?.pageUrl ?? baseUrl,
      undefined,
      uploadForms.length > 0
        ? "Found a file-upload form; server-side handling of uploaded file contents was not tested."
        : "No file-upload forms were observed during this scan's limited crawl."
    )
  );

  const pollutionShaped = params.filter((p) => /__proto__|constructor|prototype/i.test(p.paramName));
  findings.push(
    makeHeuristic(
      "owasp_prototype_pollution_heuristic",
      pollutionShaped.length > 0,
      pollutionShaped[0]?.pageUrl ?? baseUrl,
      pollutionShaped[0]?.paramName,
      pollutionShaped.length > 0
        ? "Found parameter name(s) matching common prototype-pollution gadget keys."
        : "No prototype-pollution-shaped parameter names were observed during this scan's limited crawl."
    )
  );

  // Stored XSS: this scanner never submits persistent content, so it's always "not tested"
  // rather than a heuristic guess.
  findings.push({
    category: "owasp_stored_xss_heuristic",
    severity: "info",
    title: "Stored XSS — not tested",
    confidence: "Tentative",
    affectedUrl: baseUrl,
    description:
      "Confirming stored XSS requires submitting content through a form and then viewing it as a different user/session — this scanner never submits persistent content, so this category was not tested.",
    recommendation: "Manually review any user-generated-content rendering path (comments, profiles, messages) for output encoding.",
  });

  return findings;
}

function dedupeParams(params: DiscoveredParam[]): DiscoveredParam[] {
  const seen = new Set<string>();
  const result: DiscoveredParam[] = [];
  for (const p of params) {
    if (seen.has(p.paramName)) continue;
    seen.add(p.paramName);
    result.push(p);
  }
  return result;
}

export interface OwaspActiveResult {
  findings: Finding[];
  pagesVisited: number;
  requestsMade: number;
}

// Crawls a small, bounded set of same-origin pages (homepage + discovered links, capped) to
// find query parameters/forms, runs the three safe active probes above against discovered
// parameters, relabels existing clickjacking/DOM-XSS signals under their OWASP category, and
// always appends the heuristic-only categories (found-or-not) per the agreed disclosure
// approach.
export async function runOwaspActiveChecks(
  baseUrl: string,
  homepageHtml: string,
  httpFindings: Finding[],
  codeFindings: CodeFinding[]
): Promise<OwaspActiveResult> {
  const findings: Finding[] = [];
  let requestsMade = 1; // homepage already fetched by the caller before this module runs

  const links = extractSameOriginLinks(homepageHtml, baseUrl, MAX_CRAWL_PAGES);
  const pagesToVisit = [baseUrl, ...links].slice(0, MAX_CRAWL_PAGES);

  const allParams: DiscoveredParam[] = [...extractQueryParams(baseUrl)];
  const allForms: DiscoveredForm[] = [...extractForms(homepageHtml, baseUrl)];

  for (const pageUrl of pagesToVisit.slice(1)) {
    if (requestsMade >= MAX_TOTAL_REQUESTS) break;
    try {
      const res = await safeFetch(pageUrl);
      requestsMade++;
      if (res.status >= 200 && res.status < 300) {
        const html = await res.text();
        allParams.push(...extractQueryParams(pageUrl));
        allForms.push(...extractForms(html, pageUrl));
      }
    } catch {
      // page unreachable — skip
    }
  }

  const budget = Math.max(0, Math.floor((MAX_TOTAL_REQUESTS - requestsMade) / 3));
  const uniqueParams = dedupeParams(allParams).slice(0, budget);

  for (const param of uniqueParams) {
    if (requestsMade >= MAX_TOTAL_REQUESTS - 2) break;
    const [xss, sqli, redirect] = await Promise.all([probeReflectedXss(param), probeSqlErrorIndicator(param), probeOpenRedirect(param)]);
    requestsMade += 3;
    if (xss) findings.push(xss);
    if (sqli) findings.push(sqli);
    if (redirect) findings.push(redirect);
  }

  const missingXfo = httpFindings.some((f) => f.category === "missing_headers" && /X-Frame-Options/i.test(f.title));
  const missingCsp = httpFindings.some((f) => f.category === "missing_headers" && /Content-Security-Policy/i.test(f.title));
  if (missingXfo && missingCsp) {
    findings.push({
      category: "owasp_clickjacking",
      severity: "medium",
      title: "Clickjacking possible — no frame protection",
      confidence: "Confirmed",
      affectedUrl: baseUrl,
      description: "Both X-Frame-Options and Content-Security-Policy (frame-ancestors) are absent from the response headers.",
      recommendation: "Add X-Frame-Options: DENY/SAMEORIGIN or a CSP frame-ancestors directive.",
    });
  }

  const domXssSinks = codeFindings.filter((f) => f.category === "dangerous_function" && /innerHTML|eval\(\)/i.test(f.recommendation ?? ""));
  if (domXssSinks.length > 0) {
    findings.push({
      category: "owasp_dom_xss",
      severity: "medium",
      title: `${domXssSinks.length} client-side XSS sink(s) detected (eval/innerHTML)`,
      confidence: "Tentative",
      affectedUrl: baseUrl,
      description: "Relabeled from the JavaScript dangerous-function scan results under the OWASP DOM-XSS category.",
      recommendation: "Trace each sink back to its data source and confirm whether attacker-controlled input can reach it.",
    });
  }

  findings.push(...heuristicNotes(allParams, allForms, baseUrl));

  return { findings, pagesVisited: pagesToVisit.length, requestsMade };
}
