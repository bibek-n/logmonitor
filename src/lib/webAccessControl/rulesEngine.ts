import type { WacCriticalAllowlistEntry, WacResolution, WacSchedule, WacWebsiteRule } from "./types";

// Pure, DB-free access-decision engine (unit-testable in isolation — see rulesEngine.test.ts).
// Callers (API routes) load the current WacWebsiteRules/WacCriticalAllowlist/WacSchedules
// rows plus the requesting staff member's WacGroupId from the DB and pass them in here; this
// module never touches the network or a database itself.
//
// Priority hierarchy, highest wins, first match within a tier wins (per the approved spec):
//   1. Critical Application Allowlist — always wins, unconditionally.
//   2. Explicit staff-level Allow rule (this exact StaffId).
//   3. Explicit staff-level Block rule (this exact StaffId).
//   4. Group-level rules (the staff member's WacGroupId) — Allow and Block both live at this
//      tier; if both match the same domain, that is a genuine conflict, surfaced via
//      `conflicts` rather than silently resolved.
//   5. Default company policy — a Global-scope rule if one exists, otherwise a hardcoded
//      default of "Allow" (see the comment above the final return below for why).
//
// A Disabled rule never matches. A rule with a non-Always schedule only applies during that
// window, using SERVER-LOCAL time — this schema has no per-branch-office timezone concept,
// so no timezone adjustment is attempted here; that is a known limitation, not an oversight.

const PRIORITY_RANK: Record<WacWebsiteRule["priority"], number> = { Low: 0, Normal: 1, High: 2 };

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// Dot-boundary suffix check — a "suffix" rule for "facebook.com" matches "facebook.com"
// itself and any true subdomain ("www.facebook.com", "m.facebook.com"), but must NOT match
// "notfacebook.com" (no dot boundary) or "facebook.com.evil.com" (facebook.com is a prefix,
// not a suffix, of that domain). Same convention as classifyDomain.ts elsewhere in this app.
function domainMatches(domain: string, ruleDomain: string, matchType: "exact" | "suffix"): boolean {
  const d = domain.trim().toLowerCase();
  const rd = ruleDomain.trim().toLowerCase();
  if (matchType === "exact") return d === rd;
  return d === rd || d.endsWith("." + rd);
}

// When several rules in the same bucket (e.g. all Staff-level Allow rules) match the domain,
// prefer an exact-type match over a suffix-type match, and among suffix matches prefer the
// longest (most specific) rule domain — same tie-break as classifyDomain.matchCategoryRule.
function bestDomainMatch<T extends { domain: string; matchType: "exact" | "suffix" }>(domain: string, candidates: T[]): T | null {
  const d = domain.trim().toLowerCase();
  const exact = candidates.find((c) => c.matchType === "exact" && c.domain.trim().toLowerCase() === d);
  if (exact) return exact;

  const matching = candidates.filter((c) => domainMatches(d, c.domain, c.matchType));
  if (matching.length === 0) return null;
  return matching.reduce((longest, c) => (c.domain.length > longest.domain.length ? c : longest));
}

function parseMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  return (h || 0) * 60 + (m || 0);
}

// Exported for reuse outside the rules engine (e.g. Mobile Devices scheduled blocking) - the
// day/time-window matching logic here has nothing WAC-specific about it.
export function isScheduleActive(schedule: WacSchedule, now: Date): boolean {
  // No days/times configured at all ("Always", including the built-in seeded row) — no
  // restriction.
  if (!schedule.daysOfWeek && !schedule.startTime && !schedule.endTime) return true;

  if (schedule.daysOfWeek) {
    const days = schedule.daysOfWeek.split(",").map((d) => d.trim());
    if (!days.includes(DAY_NAMES[now.getDay()])) return false;
  }

  if (schedule.startTime && schedule.endTime) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = parseMinutes(schedule.startTime);
    const endMinutes = parseMinutes(schedule.endTime);
    if (startMinutes <= endMinutes) {
      return nowMinutes >= startMinutes && nowMinutes < endMinutes;
    }
    // Overnight window (e.g. 22:00-06:00) wraps past midnight.
    return nowMinutes >= startMinutes || nowMinutes < endMinutes;
  }

  return true;
}

function isRuleActiveNow(rule: WacWebsiteRule, schedulesById: Map<number, WacSchedule>, now: Date): boolean {
  if (rule.status !== "Enabled") return false;
  if (rule.scheduleId === null) return true;
  const schedule = schedulesById.get(rule.scheduleId);
  // A dangling ScheduleId (schedule deleted after the rule referenced it) is a data
  // inconsistency, not something this pure function should guess about — treat as "no
  // schedule restriction" (same as Always) rather than silently deactivating the rule.
  if (!schedule) return true;
  return isScheduleActive(schedule, now);
}

function pickTieBreakWinner(a: WacWebsiteRule, b: WacWebsiteRule): WacWebsiteRule {
  const pa = PRIORITY_RANK[a.priority];
  const pb = PRIORITY_RANK[b.priority];
  if (pa !== pb) return pa > pb ? a : b;
  const ta = Date.parse(a.updatedAt);
  const tb = Date.parse(b.updatedAt);
  if (ta !== tb) return ta > tb ? a : b;
  return a.id >= b.id ? a : b;
}

export interface ResolveAccessInput {
  domain: string;
  staffId: number;
  // The requesting staff member's current group (from Staff.WacGroupId) — null if
  // unassigned, in which case no Group-tier rule can match them.
  staffGroupId: number | null;
  rules: WacWebsiteRule[];
  allowlist: WacCriticalAllowlistEntry[];
  schedules: WacSchedule[];
  // Injectable for deterministic tests; defaults to the real current time.
  now?: Date;
}

export function resolveAccess(input: ResolveAccessInput): WacResolution {
  const { domain, staffId, staffGroupId, rules, allowlist, schedules } = input;
  const now = input.now ?? new Date();
  const schedulesById = new Map(schedules.map((s) => [s.id, s]));

  // Tier 1: Critical Application Allowlist — always wins, unconditionally. Allowlist rows
  // have no Status/Schedule concept (they are permanent overrides by design), so no
  // enabled/schedule filtering applies here at all.
  const allowlistCandidates = allowlist.filter((a): a is WacCriticalAllowlistEntry & { domain: string } => a.domain !== null);
  const allowlistMatch = bestDomainMatch(domain, allowlistCandidates);
  if (allowlistMatch) {
    return { decision: "Allow", tier: "CriticalAllowlist", matchedRule: allowlistMatch, conflicts: [] };
  }

  const activeRules = rules.filter((r) => isRuleActiveNow(r, schedulesById, now));

  // Tiers 2 & 3: explicit staff-level rules for this exact StaffId.
  const staffRules = activeRules.filter((r) => r.scopeType === "Staff" && r.staffId === staffId && domainMatches(domain, r.domain, r.matchType));
  const staffAllow = bestDomainMatch(domain, staffRules.filter((r) => r.action === "Allow"));
  if (staffAllow) return { decision: "Allow", tier: "StaffAllow", matchedRule: staffAllow, conflicts: [] };
  const staffBlock = bestDomainMatch(domain, staffRules.filter((r) => r.action === "Block"));
  if (staffBlock) return { decision: "Block", tier: "StaffBlock", matchedRule: staffBlock, conflicts: [] };

  // Tier 4: group-level rules for the staff member's WacGroupId. This schema gives each
  // staff member exactly one group, but that single group can still carry both an Allow and
  // a Block rule for the same domain (e.g. two admins editing policy independently) — that
  // is a real conflict, not something to silently resolve without telling anyone.
  if (staffGroupId !== null) {
    const groupRules = activeRules.filter((r) => r.scopeType === "Group" && r.wacGroupId === staffGroupId && domainMatches(domain, r.domain, r.matchType));
    const groupAllow = bestDomainMatch(domain, groupRules.filter((r) => r.action === "Allow"));
    const groupBlock = bestDomainMatch(domain, groupRules.filter((r) => r.action === "Block"));

    if (groupAllow && groupBlock) {
      const winner = pickTieBreakWinner(groupAllow, groupBlock);
      return { decision: winner.action, tier: "Group", matchedRule: winner, conflicts: [groupAllow, groupBlock] };
    }
    if (groupAllow) return { decision: "Allow", tier: "Group", matchedRule: groupAllow, conflicts: [] };
    if (groupBlock) return { decision: "Block", tier: "Group", matchedRule: groupBlock, conflicts: [] };
  }

  // Tier 5: default company policy — a Global-scope rule if one exists.
  const globalRules = activeRules.filter((r) => r.scopeType === "Global" && domainMatches(domain, r.domain, r.matchType));
  const globalMatch = bestDomainMatch(domain, globalRules);
  if (globalMatch) return { decision: globalMatch.action, tier: "GlobalPolicy", matchedRule: globalMatch, conflicts: [] };

  // No rule at any tier matched at all. Defaulting to "Allow" here is a deliberate design
  // choice: a fresh install with zero configured rules should not silently block the entire
  // internet for every employee — that failure mode (everything broken, no obvious cause) is
  // worse than being slightly under-restrictive until an admin adds real policy. Once any
  // Global rule exists it fully overrides this default.
  return { decision: "Allow", tier: "DefaultPolicy", matchedRule: null, conflicts: [] };
}
