import type { DomainCategoryRule } from "./types";

// Pure matcher (unit-testable in isolation from the DB): exact match always wins over a
// suffix match, even if a shorter/longer suffix rule also exists. Among suffix matches, the
// longest (most specific) domain wins — e.g. "mail.example.com" over "example.com" if both
// happen to be configured. Boundary-aware suffix comparison, same rule as
// excludedDomainsFilter.ts, so "example.com.evil.com" never matches a rule for "example.com".
export function matchCategoryRule(domain: string, rules: DomainCategoryRule[]): DomainCategoryRule | null {
  const normalizedDomain = domain.trim().toLowerCase();

  const exact = rules.find((rule) => rule.matchType === "exact" && rule.domain.toLowerCase() === normalizedDomain);
  if (exact) return exact;

  const exactAsSuffix = rules.find((rule) => rule.matchType !== "exact" && rule.domain.toLowerCase() === normalizedDomain);
  if (exactAsSuffix) return exactAsSuffix;

  const suffixMatches = rules.filter((rule) => {
    if (rule.matchType === "exact") return false;
    const ruleDomain = rule.domain.trim().toLowerCase();
    return normalizedDomain.endsWith("." + ruleDomain);
  });
  if (suffixMatches.length === 0) return null;

  return suffixMatches.reduce((longest, candidate) => (candidate.domain.length > longest.domain.length ? candidate : longest));
}
