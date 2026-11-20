import { whoisLookup } from "@/lib/ipTools";

// WHOIS expiry-date field names vary by registrar/TLD (this is a real, unavoidable limitation
// of WHOIS - there's no single standard field) - tried in order, first match wins. Covers every
// gTLD registrar response seen in practice (Verisign/ICANN-format "Registry Expiry Date",
// GoDaddy/Namecheap-style "Registrar Registration Expiration Date") plus a few ccTLD variants
// (.ru's "paid-till", generic "renewal date"). Returns null rather than throwing when nothing
// matches - a domain whose registry just doesn't expose this cleanly is skipped, not treated as
// imminently expiring.
const EXPIRY_FIELD_PATTERNS = [
  /Registry Expiry Date:\s*(.+)/i,
  /Registrar Registration Expiration Date:\s*(.+)/i,
  /Domain Expiration Date:\s*(.+)/i,
  /Expiration Date:\s*(.+)/i,
  /Expiry Date:\s*(.+)/i,
  /Renewal Date:\s*(.+)/i,
  /paid-till:\s*(.+)/i,
];

export function extractDomainExpiryDate(whoisText: string): Date | null {
  for (const pattern of EXPIRY_FIELD_PATTERNS) {
    const match = whoisText.match(pattern);
    if (!match) continue;
    const date = new Date(match[1].trim());
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

// Heuristic, not a full Public Suffix List implementation - good enough to pick the right
// domain to WHOIS-query (unlike website categorization, getting this slightly wrong just means
// one monitor's domain-expiry check targets the wrong label and comes back empty, not a
// user-facing miscategorization). Covers the handful of multi-label suffixes this app's actual
// monitored sites use; falls back to the last two labels for everything else.
const MULTI_LABEL_SUFFIXES = ["co.uk", "co.in", "co.jp", "co.nz", "com.au", "com.np", "co.np", "org.np", "edu.np", "gov.np", "net.np"];

export function extractRegistrableDomain(url: string): string | null {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  const parts = hostname.split(".");
  if (parts.length < 2) return null;

  const lastTwo = parts.slice(-2).join(".");
  if (parts.length >= 3 && MULTI_LABEL_SUFFIXES.includes(lastTwo)) {
    return parts.slice(-3).join(".");
  }
  return lastTwo;
}

export interface DomainExpiryLookup {
  domain: string;
  expiresAt: Date | null;
}

// Never throws - WHOIS lookups are flaky by nature (server rate limits, referral chains,
// unparseable formats) and a lookup failure must not break the scheduled check that triggered
// it, same convention as every other best-effort step in this scan loop.
export async function lookupDomainExpiry(url: string): Promise<DomainExpiryLookup | null> {
  const domain = extractRegistrableDomain(url);
  if (!domain) return null;
  try {
    const text = await whoisLookup(domain);
    return { domain, expiresAt: extractDomainExpiryDate(text) };
  } catch {
    return null;
  }
}
