// Sensitive-domain exclusion matching — shared by the agent-side pre-filter (via the
// excludedDomainSuffixes list pushed on heartbeat) and the server-side ingest re-check
// (defense-in-depth in case the agent is running a stale list). Suffix matching must be
// boundary-aware: "example-bank.com.evil.com" must NOT match an excluded "example-bank.com"
// just because the string happens to appear as a substring.
export function isDomainExcluded(domain: string, excludedDomains: string[]): boolean {
  const normalizedDomain = domain.trim().toLowerCase();
  for (const excluded of excludedDomains) {
    const normalizedExcluded = excluded.trim().toLowerCase();
    if (!normalizedExcluded) continue;
    if (normalizedDomain === normalizedExcluded) return true;
    if (normalizedDomain.endsWith("." + normalizedExcluded)) return true;
  }
  return false;
}
