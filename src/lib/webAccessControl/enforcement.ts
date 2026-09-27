import { loadRulesEngineData, getStaffGroupId } from "./loadData";
import { resolveAccess } from "./rulesEngine";
import type { WacWebsiteRule } from "./types";

// Enforcement-side helper feeding the endpoint agent's local hosts-file/DoH blocking (see
// agent/wacblock_windows.go) — NOT related to the still-unimplemented Sophos Firewall sync
// stub (sophosFirewallService.ts), which remains honest about having no real Sophos admin API
// access rather than pretending to sync anything.
//
// rulesEngine.resolveAccess is a pure, per-domain decision function — given one candidate
// domain, it says Allow or Block. It does not enumerate which domains exist at all. This module
// is the missing piece: it works out which domains could possibly matter for a given staff
// member in the first place, so the agent is only ever handed the (small) set of domains that
// actually resolve to Block for that person, not every domain any rule anywhere mentions.
export async function getBlockedDomainsForStaff(staffId: number, now?: Date): Promise<string[]> {
  const { rules, allowlist, schedules } = await loadRulesEngineData();
  const staffGroupId = await getStaffGroupId(staffId);

  // Only rules that could ever possibly apply to this staff member are worth resolving — a
  // rule scoped to a different StaffId, or to a Group this staff member doesn't belong to, can
  // never affect them per resolveAccess's own tier logic, so there's no need to resolve every
  // domain in the whole table for every staff member on every heartbeat.
  const relevantRules = rules.filter(
    (r: WacWebsiteRule) =>
      (r.scopeType === "Staff" && r.staffId === staffId) ||
      (r.scopeType === "Group" && staffGroupId !== null && r.wacGroupId === staffGroupId) ||
      r.scopeType === "Global"
  );

  const candidateDomains = Array.from(new Set(relevantRules.map((r) => r.domain)));

  const blocked: string[] = [];
  for (const domain of candidateDomains) {
    // Pass the FULL unfiltered rules/allowlist/schedules here (not relevantRules) so the real
    // priority/conflict/allowlist logic in resolveAccess still runs exactly as it would for a
    // live request — relevantRules above is only used to build the candidate domain list, never
    // as the resolution input itself.
    const resolution = resolveAccess({ domain, staffId, staffGroupId, rules, allowlist, schedules, now });
    if (resolution.decision === "Block") {
      blocked.push(domain);
    }
  }

  return blocked;
}
