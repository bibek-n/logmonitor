// WAF Gateway's request-evaluation engine: given one inbound request and an application's
// current rules, decides Allow/Block/Log/RateLimit/Challenge - pure, DB-free and network-free,
// same "load data elsewhere, decide here" split as Web Access Control's rulesEngine.ts and
// Security Center's evaluateWaf (src/lib/securityCenter/wafEnforcement.ts), whose rate-limit/
// custom-rule/country-rule matching conventions this reuses rather than reinventing, adapted to
// the Gateway's own schema (WafApplications/WafRules/WafRateLimits, not WafCustomRules/
// WafRateLimitRules - two separate systems that happen to share WafIpRules/WafCountryRules).
//
// This module never blocks a live request on its own: evaluate() is synchronous and every
// error path returns "allow" (see the try/catch at the bottom) - a bad rule (malformed regex,
// bad IP format) must never be able to take a protected site down, exactly like Security
// Center's WAF and Web Access Control's rules engine before it.

export type WafRuleTarget = "Url" | "QueryString" | "Headers" | "Cookies" | "Body" | "UserAgent" | "IpAddress" | "HttpMethod";
export type WafRuleAction = "Allow" | "Block" | "Log" | "Challenge" | "RateLimit";
export type WafRuleMode = "Global" | "Application" | "Endpoint";

export interface WafRuleRow {
  id: number;
  ruleName: string;
  category: string;
  severity: "Informational" | "Low" | "Medium" | "High" | "Critical";
  pattern: string;
  target: WafRuleTarget;
  action: WafRuleAction;
  enabled: boolean;
  mode: WafRuleMode;
  applicationId: number | null;
  endpointPath: string | null;
}

export interface WafRateLimitRow {
  id: number;
  applicationId: number;
  path: string;
  httpMethod: string | null;
  requestLimit: number;
  windowSeconds: number;
  action: "Block" | "429";
  enabled: boolean;
}

export interface WafIpRuleRow {
  ipOrCidr: string;
  type: "Allow" | "Block";
}

export interface WafCountryRuleRow {
  countryCode: string;
  action: "Allow" | "Block";
  isActive: boolean;
}

export interface WafRequestContext {
  applicationId: number;
  method: string;
  path: string; // pathname only, no query string
  queryString: string; // including leading "?", or ""
  ip: string | null;
  country: string | null; // pre-resolved by the caller (geoip is I/O-ish at require-time only, but keeping this module network-free)
  userAgent: string | null;
  headers: Record<string, string>; // lower-cased header names
  cookies: Record<string, string>;
  bodySample: string | null; // best-effort, size-capped snippet - never the full body (see server.ts)
}

export type WafDecision =
  | { outcome: "allow" }
  | { outcome: "log"; rule: WafRuleRow }
  | { outcome: "block"; reason: string; rule: WafRuleRow | null; category: string }
  | { outcome: "rate_limited"; reason: string; limit: WafRateLimitRow };

// A match value wrapped in /.../ (optionally with flags after the closing slash) is a regex;
// anything else is a case-insensitive substring match - same convention as
// securityCenter/wafEnforcement.ts's valueMatches, so admins moving between the two WAF
// surfaces don't have to learn two different pattern syntaxes. An invalid regex falls back to
// literal substring matching rather than throwing.
export function patternMatches(value: string, pattern: string): boolean {
  const regexForm = pattern.match(/^\/(.*)\/([a-z]*)$/i);
  if (regexForm) {
    try {
      const flags = regexForm[2].includes("i") ? regexForm[2] : regexForm[2] + "i";
      return new RegExp(regexForm[1], flags).test(value);
    } catch {
      // Malformed regex - fall through to literal substring matching below.
    }
  }
  return value.toLowerCase().includes(pattern.toLowerCase());
}

function ipInCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes("/")) return ip === cidr;
  const [range, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  if (!Number.isFinite(bits)) return false;
  // IPv4 only - IPv6 CIDR matching would need a real library; an IPv6 rule with a "/" is just
  // never matched here rather than mis-evaluated, and a bare-IP IPv6 rule still matches exactly
  // via the `ip === cidr` branch above.
  const toInt = (addr: string): number | null => {
    const parts = addr.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  };
  const ipInt = toInt(ip);
  const rangeInt = toInt(range);
  if (ipInt === null || rangeInt === null || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

function targetValue(ctx: WafRequestContext, target: WafRuleTarget): string | null {
  switch (target) {
    case "Url":
      return ctx.path;
    case "QueryString":
      return ctx.queryString;
    case "UserAgent":
      return ctx.userAgent;
    case "IpAddress":
      return ctx.ip;
    case "HttpMethod":
      return ctx.method;
    case "Body":
      return ctx.bodySample;
    case "Headers":
      return Object.values(ctx.headers).join("\n");
    case "Cookies":
      return Object.values(ctx.cookies).join("\n");
  }
}

function ruleAppliesToRequest(rule: WafRuleRow, ctx: WafRequestContext): boolean {
  if (!rule.enabled) return false;
  if (rule.mode === "Application" && rule.applicationId !== ctx.applicationId) return false;
  if (rule.mode === "Endpoint") {
    if (rule.applicationId !== ctx.applicationId) return false;
    if (rule.endpointPath && !ctx.path.startsWith(rule.endpointPath)) return false;
  }
  return true;
}

function matchRules(rules: WafRuleRow[], ctx: WafRequestContext): WafRuleRow | null {
  for (const rule of rules) {
    if (!ruleAppliesToRequest(rule, ctx)) continue;
    const value = targetValue(ctx, rule.target);
    if (value === null) continue;
    if (patternMatches(value, rule.pattern)) return rule;
  }
  return null;
}

// Fixed-window counter, one per (rateLimitRule.id, ip) - same tradeoff as
// securityCenter/wafEnforcement.ts's checkRateLimit (O(1) memory per key, up to ~2x the
// configured rate right at a window boundary; not exactness-critical here).
export class RateLimitTracker {
  private counters = new Map<string, { windowStart: number; count: number }>();
  private lastSweptAt = Date.now();
  private static readonly MAX_ENTRIES = 50_000;
  private static readonly SWEEP_INTERVAL_MS = 5 * 60_000;

  private sweep(maxWindowMs: number, now: number): void {
    if (now - this.lastSweptAt < RateLimitTracker.SWEEP_INTERVAL_MS && this.counters.size < RateLimitTracker.MAX_ENTRIES) return;
    this.lastSweptAt = now;
    for (const [key, counter] of this.counters) {
      if (now - counter.windowStart > maxWindowMs) this.counters.delete(key);
    }
  }

  // Returns true if this request pushed the (rule, ip) pair over its limit.
  hit(rule: WafRateLimitRow, ip: string, now = Date.now()): boolean {
    this.sweep(rule.windowSeconds * 1000, now);
    const key = `${rule.id}:${ip}`;
    const windowMs = rule.windowSeconds * 1000;
    let counter = this.counters.get(key);
    if (!counter || now - counter.windowStart >= windowMs) {
      counter = { windowStart: now, count: 0 };
      this.counters.set(key, counter);
    }
    counter.count++;
    return counter.count > rule.requestLimit;
  }

  size(): number {
    return this.counters.size;
  }
}

function matchRateLimit(limits: WafRateLimitRow[], ctx: WafRequestContext, tracker: RateLimitTracker): WafRateLimitRow | null {
  if (!ctx.ip) return null;
  for (const limit of limits) {
    if (!limit.enabled || limit.applicationId !== ctx.applicationId) continue;
    if (!ctx.path.startsWith(limit.path)) continue;
    if (limit.httpMethod && limit.httpMethod.toUpperCase() !== ctx.method.toUpperCase()) continue;
    if (tracker.hit(limit, ctx.ip)) return limit;
  }
  return null;
}

export interface WafRuleSet {
  ipRules: WafIpRuleRow[];
  countryRules: WafCountryRuleRow[];
  rules: WafRuleRow[]; // Enabled=1 rows only, expected pre-filtered by the caller (matches ruleAppliesToRequest's own enabled check as defense-in-depth)
  rateLimits: WafRateLimitRow[];
}

// The single entry point the proxy server calls per request. Order, highest priority first:
//   1. IP rules - Allow always wins outright; Block stops here.
//   2. Country rules - same Allow-wins-outright / Block-stops-here semantics.
//   3. Custom/pattern rules (WafRules) - Allow wins outright; Block/Challenge stop here; Log
//      continues to rate limiting (same "LogOnly falls through" convention as Security
//      Center's WAF).
//   4. Rate limits.
// Never throws - any internal error is caught and treated as "allow", logged by the caller.
export function evaluateRequest(ctx: WafRequestContext, ruleSet: WafRuleSet, tracker: RateLimitTracker): WafDecision {
  try {
    if (ctx.ip) {
      for (const ipRule of ruleSet.ipRules) {
        if (!ipInCidr(ctx.ip, ipRule.ipOrCidr)) continue;
        if (ipRule.type === "Allow") return { outcome: "allow" };
        return { outcome: "block", reason: `Source IP is on the WAF Gateway block list (${ipRule.ipOrCidr}).`, rule: null, category: "ip_block" };
      }
    }

    if (ctx.country) {
      const countryMatch = ruleSet.countryRules.find((r) => r.isActive && r.countryCode === ctx.country);
      if (countryMatch) {
        if (countryMatch.action === "Allow") return { outcome: "allow" };
        return { outcome: "block", reason: `Blocked by WAF country rule (${countryMatch.countryCode}).`, rule: null, category: "country_block" };
      }
    }

    const ruleMatch = matchRules(ruleSet.rules, ctx);
    if (ruleMatch) {
      if (ruleMatch.action === "Allow") return { outcome: "allow" };
      if (ruleMatch.action === "Block" || ruleMatch.action === "Challenge") {
        return { outcome: "block", reason: `Blocked by WAF rule "${ruleMatch.ruleName}" (${ruleMatch.category}).`, rule: ruleMatch, category: ruleMatch.category };
      }
      if (ruleMatch.action === "Log") {
        // Falls through to rate limiting below, but the caller still gets told a rule matched
        // so it can write a WafAttackEvents row without treating the request as blocked.
        const rateHit = matchRateLimit(ruleSet.rateLimits, ctx, tracker);
        if (rateHit) return { outcome: "rate_limited", reason: `Rate limit exceeded on ${rateHit.path}.`, limit: rateHit };
        return { outcome: "log", rule: ruleMatch };
      }
      // RateLimit action on a pattern rule: treat the match itself as the signal, no separate counter needed.
      return { outcome: "block", reason: `Blocked by WAF rule "${ruleMatch.ruleName}" (rate-limit action).`, rule: ruleMatch, category: ruleMatch.category };
    }

    const rateHit = matchRateLimit(ruleSet.rateLimits, ctx, tracker);
    if (rateHit) return { outcome: "rate_limited", reason: `Rate limit exceeded on ${rateHit.path}.`, limit: rateHit };

    return { outcome: "allow" };
  } catch (err) {
    console.error("[waf-gateway] evaluation error - failing open (request allowed):", err instanceof Error ? err.message : err);
    return { outcome: "allow" };
  }
}
