import { describe, expect, it } from "vitest";
import { RateLimitTracker, evaluateRequest, patternMatches, type WafRequestContext, type WafRuleSet } from "./proxyEngine";

function ctx(overrides: Partial<WafRequestContext> = {}): WafRequestContext {
  return {
    applicationId: 1,
    method: "GET",
    path: "/",
    queryString: "",
    ip: "203.0.113.5",
    country: null,
    userAgent: "Mozilla/5.0",
    headers: {},
    cookies: {},
    bodySample: null,
    ...overrides,
  };
}

const emptyRuleSet: WafRuleSet = { ipRules: [], countryRules: [], rules: [], rateLimits: [] };

describe("patternMatches", () => {
  it("does a case-insensitive substring match for a plain pattern", () => {
    expect(patternMatches("/admin/login.php", "login.php")).toBe(true);
    expect(patternMatches("/ADMIN/LOGIN.PHP", "login.php")).toBe(true);
    expect(patternMatches("/dashboard", "login.php")).toBe(false);
  });

  it("treats /.../  as a regex", () => {
    expect(patternMatches("/wp-admin/setup.php", "/wp-admin.*\\.php$/")).toBe(true);
    expect(patternMatches("/other", "/wp-admin.*\\.php$/")).toBe(false);
  });

  it("falls back to literal matching on an invalid regex rather than throwing", () => {
    expect(() => patternMatches("has [unclosed", "/[unclosed/")).not.toThrow();
  });
});

describe("evaluateRequest - IP rules", () => {
  it("blocks a request from a blocked IP", () => {
    const ruleSet: WafRuleSet = { ...emptyRuleSet, ipRules: [{ ipOrCidr: "203.0.113.5", type: "Block" }] };
    const d = evaluateRequest(ctx(), ruleSet, new RateLimitTracker());
    expect(d.outcome).toBe("block");
  });

  it("allows a request from an allow-listed IP even if other rules would block it", () => {
    const ruleSet: WafRuleSet = {
      ...emptyRuleSet,
      ipRules: [{ ipOrCidr: "203.0.113.5", type: "Allow" }],
      countryRules: [{ countryCode: "XX", action: "Block", isActive: true }],
    };
    const d = evaluateRequest(ctx({ country: "XX" }), ruleSet, new RateLimitTracker());
    expect(d.outcome).toBe("allow");
  });

  it("matches a CIDR range", () => {
    const ruleSet: WafRuleSet = { ...emptyRuleSet, ipRules: [{ ipOrCidr: "203.0.113.0/24", type: "Block" }] };
    expect(evaluateRequest(ctx({ ip: "203.0.113.200" }), ruleSet, new RateLimitTracker()).outcome).toBe("block");
    expect(evaluateRequest(ctx({ ip: "203.0.114.1" }), ruleSet, new RateLimitTracker()).outcome).toBe("allow");
  });
});

describe("evaluateRequest - country rules", () => {
  it("blocks a matching country", () => {
    const ruleSet: WafRuleSet = { ...emptyRuleSet, countryRules: [{ countryCode: "KP", action: "Block", isActive: true }] };
    expect(evaluateRequest(ctx({ country: "KP" }), ruleSet, new RateLimitTracker()).outcome).toBe("block");
  });

  it("ignores an inactive country rule", () => {
    const ruleSet: WafRuleSet = { ...emptyRuleSet, countryRules: [{ countryCode: "KP", action: "Block", isActive: false }] };
    expect(evaluateRequest(ctx({ country: "KP" }), ruleSet, new RateLimitTracker()).outcome).toBe("allow");
  });
});

describe("evaluateRequest - pattern rules", () => {
  const sqliRule = {
    id: 1,
    ruleName: "SQL injection in query string",
    category: "sql_injection",
    severity: "High" as const,
    pattern: "/(\\bunion\\b.*\\bselect\\b|\\bor\\b\\s+1\\s*=\\s*1)/i",
    target: "QueryString" as const,
    action: "Block" as const,
    enabled: true,
    mode: "Global" as const,
    applicationId: null,
    endpointPath: null,
  };

  it("blocks a request whose query string matches a Block rule", () => {
    const ruleSet: WafRuleSet = { ...emptyRuleSet, rules: [sqliRule] };
    const d = evaluateRequest(ctx({ queryString: "?id=1' OR 1=1--" }), ruleSet, new RateLimitTracker());
    expect(d.outcome).toBe("block");
    if (d.outcome === "block") expect(d.rule?.ruleName).toBe(sqliRule.ruleName);
  });

  it("does not block a clean request", () => {
    const ruleSet: WafRuleSet = { ...emptyRuleSet, rules: [sqliRule] };
    const d = evaluateRequest(ctx({ queryString: "?id=42" }), ruleSet, new RateLimitTracker());
    expect(d.outcome).toBe("allow");
  });

  it("Log action logs but never blocks the request", () => {
    const rule = { ...sqliRule, action: "Log" as const };
    const ruleSet: WafRuleSet = { ...emptyRuleSet, rules: [rule] };
    const d = evaluateRequest(ctx({ queryString: "?id=1 union select 1" }), ruleSet, new RateLimitTracker());
    expect(d.outcome).toBe("log");
  });

  it("a disabled rule never matches", () => {
    const rule = { ...sqliRule, enabled: false };
    const ruleSet: WafRuleSet = { ...emptyRuleSet, rules: [rule] };
    const d = evaluateRequest(ctx({ queryString: "?id=1 union select 1" }), ruleSet, new RateLimitTracker());
    expect(d.outcome).toBe("allow");
  });

  it("an Application-scoped rule never matches a different application", () => {
    const rule = { ...sqliRule, mode: "Application" as const, applicationId: 99 };
    const ruleSet: WafRuleSet = { ...emptyRuleSet, rules: [rule] };
    const d = evaluateRequest(ctx({ applicationId: 1, queryString: "?id=1 union select 1" }), ruleSet, new RateLimitTracker());
    expect(d.outcome).toBe("allow");
  });

  it("an Endpoint-scoped rule only matches under its path prefix", () => {
    const rule = { ...sqliRule, mode: "Endpoint" as const, applicationId: 1, endpointPath: "/api/" };
    const ruleSet: WafRuleSet = { ...emptyRuleSet, rules: [rule] };
    const hit = evaluateRequest(ctx({ applicationId: 1, path: "/api/users", queryString: "?id=1 union select 1" }), ruleSet, new RateLimitTracker());
    const miss = evaluateRequest(ctx({ applicationId: 1, path: "/public", queryString: "?id=1 union select 1" }), ruleSet, new RateLimitTracker());
    expect(hit.outcome).toBe("block");
    expect(miss.outcome).toBe("allow");
  });

  it("an Allow rule short-circuits, e.g. allow-listing a known scanner's User-Agent", () => {
    const allowRule = { ...sqliRule, target: "UserAgent" as const, pattern: "trusted-scanner", action: "Allow" as const };
    const ruleSet: WafRuleSet = { ...emptyRuleSet, rules: [allowRule, sqliRule] };
    const d = evaluateRequest(ctx({ userAgent: "trusted-scanner/1.0", queryString: "?id=1 union select 1" }), ruleSet, new RateLimitTracker());
    expect(d.outcome).toBe("allow");
  });

  it("matches against Headers and Cookies targets", () => {
    const headerRule = { ...sqliRule, target: "Headers" as const, pattern: "sqlmap" };
    const headerSet: WafRuleSet = { ...emptyRuleSet, rules: [headerRule] };
    expect(evaluateRequest(ctx({ headers: { "x-scanner": "sqlmap/1.6" } }), headerSet, new RateLimitTracker()).outcome).toBe("block");

    const cookieRule = { ...sqliRule, target: "Cookies" as const, pattern: "session-id-attack" };
    const cookieSet: WafRuleSet = { ...emptyRuleSet, rules: [cookieRule] };
    expect(evaluateRequest(ctx({ cookies: { sid: "session-id-attack" } }), cookieSet, new RateLimitTracker()).outcome).toBe("block");
  });
});

describe("evaluateRequest - rate limiting", () => {
  it("allows requests under the limit and blocks once the limit is exceeded", () => {
    const ruleSet: WafRuleSet = {
      ...emptyRuleSet,
      rateLimits: [{ id: 1, applicationId: 1, path: "/login", httpMethod: null, requestLimit: 3, windowSeconds: 60, action: "Block", enabled: true }],
    };
    const tracker = new RateLimitTracker();
    const results = Array.from({ length: 5 }, () => evaluateRequest(ctx({ path: "/login" }), ruleSet, tracker).outcome);
    expect(results).toEqual(["allow", "allow", "allow", "rate_limited", "rate_limited"]);
  });

  it("only counts requests to the configured path prefix", () => {
    const ruleSet: WafRuleSet = {
      ...emptyRuleSet,
      rateLimits: [{ id: 1, applicationId: 1, path: "/login", httpMethod: null, requestLimit: 1, windowSeconds: 60, action: "Block", enabled: true }],
    };
    const tracker = new RateLimitTracker();
    evaluateRequest(ctx({ path: "/login" }), ruleSet, tracker);
    const other = evaluateRequest(ctx({ path: "/other" }), ruleSet, tracker);
    expect(other.outcome).toBe("allow");
  });

  it("resets after the window elapses", () => {
    const rule = { id: 1, applicationId: 1, path: "/login", httpMethod: null, requestLimit: 1, windowSeconds: 1, action: "Block" as const, enabled: true };
    const tracker = new RateLimitTracker();
    expect(tracker.hit(rule, "1.2.3.4", 0)).toBe(false);
    expect(tracker.hit(rule, "1.2.3.4", 100)).toBe(true); // still within the 1s window
    expect(tracker.hit(rule, "1.2.3.4", 2000)).toBe(false); // new window
  });

  it("tracks rate limits per IP independently", () => {
    const rule = { id: 1, applicationId: 1, path: "/login", httpMethod: null, requestLimit: 1, windowSeconds: 60, action: "Block" as const, enabled: true };
    const tracker = new RateLimitTracker();
    expect(tracker.hit(rule, "1.1.1.1", 0)).toBe(false);
    expect(tracker.hit(rule, "2.2.2.2", 0)).toBe(false);
  });

  it("with no IP on the request, rate limiting is skipped entirely", () => {
    const ruleSet: WafRuleSet = {
      ...emptyRuleSet,
      rateLimits: [{ id: 1, applicationId: 1, path: "/login", httpMethod: null, requestLimit: 0, windowSeconds: 60, action: "Block", enabled: true }],
    };
    const d = evaluateRequest(ctx({ path: "/login", ip: null }), ruleSet, new RateLimitTracker());
    expect(d.outcome).toBe("allow");
  });
});

describe("evaluateRequest - fails open", () => {
  it("never throws even given a pathological pattern rule", () => {
    const rule = {
      id: 1,
      ruleName: "bad",
      category: "test",
      severity: "Low" as const,
      pattern: "/(/",
      target: "Url" as const,
      action: "Block" as const,
      enabled: true,
      mode: "Global" as const,
      applicationId: null,
      endpointPath: null,
    };
    const ruleSet: WafRuleSet = { ...emptyRuleSet, rules: [rule] };
    expect(() => evaluateRequest(ctx(), ruleSet, new RateLimitTracker())).not.toThrow();
  });
});
