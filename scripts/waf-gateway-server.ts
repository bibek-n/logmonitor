import "dotenv/config";
import http from "http";
import https from "https";
import geoip from "geoip-lite";
import { getDb, sql } from "../src/lib/db";
import {
  RateLimitTracker,
  evaluateRequest,
  type WafDecision,
  type WafIpRuleRow,
  type WafCountryRuleRow,
  type WafRateLimitRow,
  type WafRequestContext,
  type WafRuleRow,
  type WafRuleSet,
} from "../src/lib/wafGateway/proxyEngine";

// WAF Gateway's reverse proxy - the piece the "Reverse Proxy" dashboard page has been a stub for.
// Listens on WAF_GATEWAY_PORT (a TEST port, not the live :4433 IIS binding - deliberately not
// touching real traffic yet: see the plan this implements), matches the inbound Host header to
// a WafApplications.PublicDomain row, evaluates every request through proxyEngine, forwards it
// to that application's OriginServer:OriginPort (HTTPS with SNI, same as a normal browser would
// reach it), and streams the origin's response straight back. Every request is logged to
// WafRequestLogs; a rule/IP/country/rate-limit match is additionally logged to WafAttackEvents.
//
// WafMode gates enforcement per application: 'Disabled' skips evaluation and logging entirely
// (pure passthrough); 'Monitoring' evaluates and logs but ALWAYS forwards the request, never
// blocks; 'Blocking' actually rejects a block/rate-limited decision with 403/429. Fail-open
// throughout, same convention as Security Center's WAF and Web Access Control before it: any
// error here must never be able to take a protected site down.

const PORT = Number(process.env.WAF_GATEWAY_PORT ?? 8099);
const CACHE_TTL_MS = 30_000;
const MAX_BODY_SAMPLE_BYTES = 8 * 1024; // enough for pattern matching, never the whole request body
const MAX_REQUEST_BODY_BYTES = 25 * 1024 * 1024; // hard cap so a slow/huge upload can't exhaust memory

interface AppRow {
  id: number;
  publicDomain: string;
  originServer: string;
  originPort: number;
  httpsEnabled: boolean;
  status: "Enabled" | "Disabled";
  wafMode: "Disabled" | "Monitoring" | "Blocking";
}

let cachedApps: AppRow[] = [];
let cachedRuleSet: WafRuleSet = { ipRules: [], countryRules: [], rules: [], rateLimits: [] };
let lastRefreshedAt = 0;
let refreshInFlight: Promise<void> | null = null;
const tracker = new RateLimitTracker();

async function loadFromDb(): Promise<void> {
  const db = await getDb();
  const [apps, ipRules, countryRules, rules, rateLimits] = await Promise.all([
    db.query<{ Id: number; PublicDomain: string; OriginServer: string; OriginPort: number; HttpsEnabled: boolean; Status: string; WafMode: string }>(
      "SELECT Id, PublicDomain, OriginServer, OriginPort, HttpsEnabled, Status, WafMode FROM WafApplications"
    ),
    db.query<{ IpOrCidr: string; Type: string }>("SELECT IpOrCidr, Type FROM WafIpRules WHERE ExpiresAt IS NULL OR ExpiresAt > SYSUTCDATETIME()"),
    db.query<{ CountryCode: string; Action: string; IsActive: boolean }>("SELECT CountryCode, Action, IsActive FROM WafCountryRules WHERE IsActive = 1"),
    db.query<{
      Id: number; RuleName: string; Category: string; Severity: string; Pattern: string; Target: string; Action: string;
      Enabled: boolean; Mode: string; ApplicationId: number | null; EndpointPath: string | null;
    }>("SELECT Id, RuleName, Category, Severity, Pattern, Target, Action, Enabled, Mode, ApplicationId, EndpointPath FROM WafRules WHERE Enabled = 1"),
    db.query<{ Id: number; ApplicationId: number; Path: string; HttpMethod: string | null; RequestLimit: number; WindowSeconds: number; Action: string; Enabled: boolean }>(
      "SELECT Id, ApplicationId, Path, HttpMethod, RequestLimit, WindowSeconds, Action, Enabled FROM WafRateLimits WHERE Enabled = 1"
    ),
  ]);

  cachedApps = apps.recordset.map((a) => ({
    id: a.Id,
    publicDomain: normalizeHost(a.PublicDomain),
    originServer: a.OriginServer,
    originPort: a.OriginPort,
    httpsEnabled: a.HttpsEnabled,
    status: a.Status as AppRow["status"],
    wafMode: a.WafMode as AppRow["wafMode"],
  }));
  cachedRuleSet = {
    ipRules: ipRules.recordset.map((r): WafIpRuleRow => ({ ipOrCidr: r.IpOrCidr, type: r.Type as WafIpRuleRow["type"] })),
    countryRules: countryRules.recordset.map((r): WafCountryRuleRow => ({ countryCode: r.CountryCode, action: r.Action as WafCountryRuleRow["action"], isActive: r.IsActive })),
    rules: rules.recordset.map((r): WafRuleRow => ({
      id: r.Id, ruleName: r.RuleName, category: r.Category, severity: r.Severity as WafRuleRow["severity"], pattern: r.Pattern,
      target: r.Target as WafRuleRow["target"], action: r.Action as WafRuleRow["action"], enabled: r.Enabled, mode: r.Mode as WafRuleRow["mode"],
      applicationId: r.ApplicationId, endpointPath: r.EndpointPath,
    })),
    rateLimits: rateLimits.recordset.map((r): WafRateLimitRow => ({
      id: r.Id, applicationId: r.ApplicationId, path: r.Path, httpMethod: r.HttpMethod, requestLimit: r.RequestLimit,
      windowSeconds: r.WindowSeconds, action: r.Action as WafRateLimitRow["action"], enabled: r.Enabled,
    })),
  };
  lastRefreshedAt = Date.now();
}

function refreshIfStale(): void {
  if (Date.now() - lastRefreshedAt < CACHE_TTL_MS) return;
  if (refreshInFlight) return;
  refreshInFlight = loadFromDb()
    .catch((err) => console.error("[waf-gateway] failed to refresh rules - continuing with the last known set:", err instanceof Error ? err.message : err))
    .finally(() => {
      refreshInFlight = null;
    });
}

// Strips a scheme/path/port an admin may have pasted into PublicDomain ("https://webdev.tulipshrm.com/"),
// so matching against the inbound Host header ("webdev.tulipshrm.com") is forgiving either way.
function normalizeHost(raw: string): string {
  return raw.replace(/^https?:\/\//i, "").split("/")[0].split(":")[0].toLowerCase();
}

function clientIp(req: http.IncomingMessage): string | null {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) return xff.split(",")[0].trim();
  return req.socket.remoteAddress ?? null;
}

async function logRequest(app: AppRow, ctx: WafRequestContext, decision: WafDecision, httpStatus: number, responseTimeMs: number, requestId: string): Promise<void> {
  try {
    const db = await getDb();
    const action = decision.outcome === "allow" ? "Allow" : decision.outcome === "log" ? "Log" : decision.outcome === "rate_limited" ? "RateLimited" : "Block";
    await db
      .request()
      .input("requestId", sql.VarChar, requestId)
      .input("applicationId", sql.BigInt, app.id)
      .input("sourceIp", sql.VarChar, ctx.ip ?? "unknown")
      .input("httpMethod", sql.NVarChar, ctx.method)
      .input("requestUrl", sql.NVarChar, (ctx.path + ctx.queryString).slice(0, 2000))
      .input("httpStatus", sql.Int, httpStatus)
      .input("responseTimeMs", sql.Int, responseTimeMs)
      .input("action", sql.NVarChar, action)
      .query(
        "INSERT INTO WafRequestLogs (RequestId, ApplicationId, SourceIp, HttpMethod, RequestUrl, HttpStatus, ResponseTimeMs, Action) VALUES (@requestId, @applicationId, @sourceIp, @httpMethod, @requestUrl, @httpStatus, @responseTimeMs, @action)"
      );

    if (decision.outcome === "allow") return; // WafAttackEvents is for genuine matches only - "log" still matched a real rule, so it belongs here too.

    const country = ctx.country;
    let ruleId: number | null = null;
    let ruleName: string | null;
    let category: string;
    let severity: WafRuleRow["severity"] | "Medium";
    if (decision.outcome === "rate_limited") {
      ruleName = `Rate limit: ${decision.limit.path}`;
      category = "rate_limit";
      severity = "Medium";
    } else if (decision.outcome === "log") {
      ruleId = decision.rule.id;
      ruleName = decision.rule.ruleName;
      category = decision.rule.category;
      severity = decision.rule.severity;
    } else {
      ruleId = decision.rule?.id ?? null;
      ruleName = decision.rule?.ruleName ?? (decision.category === "ip_block" ? "IP block list" : decision.category === "country_block" ? "Country block" : null);
      category = decision.category;
      severity = decision.rule?.severity ?? "High";
    }

    await db
      .request()
      .input("applicationId", sql.BigInt, app.id)
      .input("sourceIp", sql.VarChar, ctx.ip ?? "unknown")
      .input("country", sql.VarChar, country)
      .input("httpMethod", sql.NVarChar, ctx.method)
      .input("requestUrl", sql.NVarChar, (ctx.path + ctx.queryString).slice(0, 2000))
      .input("ruleId", sql.BigInt, ruleId)
      .input("ruleName", sql.NVarChar, ruleName)
      .input("attackCategory", sql.NVarChar, category)
      .input("severity", sql.NVarChar, severity)
      .input("action", sql.NVarChar, action)
      .input("httpStatus", sql.Int, httpStatus)
      .input("userAgent", sql.NVarChar, ctx.userAgent)
      .input("requestId", sql.VarChar, requestId)
      .query(
        `INSERT INTO WafAttackEvents (ApplicationId, SourceIp, Country, HttpMethod, RequestUrl, RuleId, RuleName, AttackCategory, Severity, Action, HttpStatus, UserAgent, RequestId)
         VALUES (@applicationId, @sourceIp, @country, @httpMethod, @requestUrl, @ruleId, @ruleName, @attackCategory, @severity, @action, @httpStatus, @userAgent, @requestId)`
      );
  } catch (err) {
    console.error("[waf-gateway] failed to log request (request still handled correctly):", err instanceof Error ? err.message : err);
  }
}

function readBodySample(req: http.IncomingMessage): Promise<{ full: Buffer; sample: string | null }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_REQUEST_BODY_BYTES) {
        req.destroy();
        reject(new Error("request body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const full = Buffer.concat(chunks);
      const sample = full.length > 0 ? full.subarray(0, MAX_BODY_SAMPLE_BYTES).toString("utf8") : null;
      resolve({ full, sample });
    });
    req.on("error", reject);
  });
}

// Rule patterns are written against DECODED values ("1=1", not "1%3D1") - a client's browser or
// script percent-encodes special characters in a query string before sending it, so matching the
// raw wire form would silently miss most real injection attempts (confirmed live: an "OR 1=1"
// probe went undetected until this fix). Falls back to the raw string on a malformed %-sequence
// rather than throwing.
function safeDecode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return out;
}

function sendPlainResponse(res: http.ServerResponse, status: number, message: string): void {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(message);
}

function forwardToOrigin(app: AppRow, req: http.IncomingMessage, body: Buffer): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const transport = app.httpsEnabled ? https : http;
    const outHeaders = { ...req.headers };
    outHeaders.host = app.publicDomain;
    delete outHeaders["content-length"]; // set explicitly below from the buffered body we actually send
    outHeaders["content-length"] = String(body.length);

    const options: https.RequestOptions = {
      host: app.originServer,
      port: app.originPort,
      method: req.method,
      path: req.url,
      headers: outHeaders,
      servername: app.publicDomain, // SNI - the origin is commonly IIS serving several hostnames on one shared HTTPS port
      // The origin is reached over the loopback/LAN by IP, not by its own certificate's subject name, so
      // Node's default hostname verification would always fail here - this is the same "internal proxy
      // hop to a box we already trust by network placement" tradeoff, not a check against an untrusted host.
      rejectUnauthorized: false,
      timeout: 30_000,
    };

    const outReq = transport.request(options, (originRes) => {
      const chunks: Buffer[] = [];
      originRes.on("data", (c: Buffer) => chunks.push(c));
      originRes.on("end", () => resolve({ status: originRes.statusCode ?? 502, headers: originRes.headers, body: Buffer.concat(chunks) }));
      originRes.on("error", reject);
    });
    outReq.on("timeout", () => outReq.destroy(new Error("origin request timed out")));
    outReq.on("error", reject);
    outReq.end(body);
  });
}

const server = http.createServer(async (req, res) => {
  const startedAt = Date.now();
  const requestId = `${startedAt.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  refreshIfStale();

  try {
    const hostHeader = normalizeHost(req.headers.host ?? "");
    const app = cachedApps.find((a) => a.publicDomain === hostHeader);
    if (!app) {
      sendPlainResponse(res, 404, `WAF Gateway: no application registered for host "${hostHeader}".`);
      return;
    }
    if (app.status === "Disabled" || app.wafMode === "Disabled") {
      // Pure passthrough - no evaluation, no logging, matches WafMode='Disabled' semantics exactly.
      const { full } = await readBodySample(req);
      const originResp = await forwardToOrigin(app, req, full);
      res.writeHead(originResp.status, originResp.headers);
      res.end(originResp.body);
      return;
    }

    const { full, sample } = await readBodySample(req);
    const url = new URL(req.url ?? "/", `http://${hostHeader}`);
    const ip = clientIp(req);
    const country = ip ? geoip.lookup(ip)?.country ?? null : null;
    const ctx: WafRequestContext = {
      applicationId: app.id,
      method: req.method ?? "GET",
      path: safeDecode(url.pathname),
      queryString: safeDecode(url.search),
      ip,
      country,
      userAgent: (req.headers["user-agent"] as string) ?? null,
      headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(", ") : v ?? ""])),
      cookies: parseCookies(req.headers.cookie),
      bodySample: sample,
    };

    const decision = evaluateRequest(ctx, cachedRuleSet, tracker);
    const shouldActuallyBlock = app.wafMode === "Blocking" && (decision.outcome === "block" || decision.outcome === "rate_limited");

    if (shouldActuallyBlock) {
      const status = decision.outcome === "rate_limited" ? 429 : 403;
      sendPlainResponse(res, status, decision.outcome === "block" ? decision.reason : decision.reason);
      void logRequest(app, ctx, decision, status, Date.now() - startedAt, requestId);
      return;
    }

    // Monitoring mode (or Blocking mode with an "allow"/"log" decision): always forward.
    const originResp = await forwardToOrigin(app, req, full);
    res.writeHead(originResp.status, originResp.headers);
    res.end(originResp.body);
    void logRequest(app, ctx, decision, originResp.status, Date.now() - startedAt, requestId);
  } catch (err) {
    console.error("[waf-gateway] request handling error - failing open where possible:", err instanceof Error ? err.message : err);
    if (!res.headersSent) sendPlainResponse(res, 502, "WAF Gateway: error reaching the origin server.");
  }
});

loadFromDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`[waf-gateway] listening on port ${PORT}, ${cachedApps.length} application(s) loaded`);
    });
  })
  .catch((err) => {
    console.error("[waf-gateway] failed to load initial rule set:", err);
    process.exit(1);
  });

process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));
