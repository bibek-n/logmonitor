// Every log adapter must run raw text through this before it's stored anywhere (SecurityEvents.
// EvidenceSummary, alert evidence, notification bodies) - evidence is meant to show *that* an
// attack pattern matched, not leak the credentials the attacker or a legitimate user sent.

const REDACTION_RULES: { pattern: RegExp; replacement: string }[] = [
  // Authorization headers (Bearer/Basic/Token/etc.) - keep the scheme, drop the credential.
  { pattern: /\b(Authorization\s*:\s*)(Bearer|Basic|Token|Digest|ApiKey|Api-Key)\s+\S+/gi, replacement: "$1$2 [REDACTED]" },
  // Cookie headers entirely - individual cookie values are frequently session tokens.
  { pattern: /\b(Cookie\s*:\s*).+/gi, replacement: "$1[REDACTED]" },
  { pattern: /\b(Set-Cookie\s*:\s*).+/gi, replacement: "$1[REDACTED]" },
  // Common credential-bearing query/form/JSON field names, key=value or "key":"value" style.
  { pattern: /\b(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key)\s*[=:]\s*"?[^&"\s]+/gi, replacement: "$1=[REDACTED]" },
  // Long base64/hex-looking blobs immediately after "Bearer " or "Basic " that the header
  // rule above might not catch if wrapped in different casing/spacing.
  { pattern: /\b(Bearer|Basic)\s+[A-Za-z0-9._-]{16,}/g, replacement: "$1 [REDACTED]" },
];

const MAX_EVIDENCE_LENGTH = 2000;

export function redactSensitive(text: string): string {
  let result = text;
  for (const rule of REDACTION_RULES) {
    result = result.replace(rule.pattern, rule.replacement);
  }
  return result;
}

// Applies redaction, then caps length to fit the DB column and avoid storing an entire raw
// payload as "evidence" - a truncated, redacted excerpt is enough to show why a rule fired.
export function sanitizeEvidence(text: string | null | undefined): string | null {
  if (!text) return null;
  const redacted = redactSensitive(text);
  return redacted.length > MAX_EVIDENCE_LENGTH ? redacted.slice(0, MAX_EVIDENCE_LENGTH) + "...[truncated]" : redacted;
}

// RequestPath (the query string in particular) is exactly the kind of place a token/API key/
// password shows up in the wild - confirmed live: a real forwarded request path turned out to
// contain a plaintext chat auth token. Shared by store.ts (SecurityEvents.RequestPath) and
// alertManager.ts (SecurityAlerts.RequestPath) - both columns are NVARCHAR(2000), and
// sanitizeEvidence's "...[truncated]" suffix can overflow that on an already-long path, so
// this hard-truncates to fit instead of appending anything.
export function sanitizeRequestPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const redacted = redactSensitive(path);
  return redacted.length > 2000 ? redacted.slice(0, 2000) : redacted;
}

// IP anonymization (privacy requirement, off by default - detection needs the real IP to
// correlate repeated behavior; this is for exported reports/notifications where an admin
// has opted into masking the last octet/segment).
export function anonymizeIp(ip: string): string {
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.slice(0, 4).join(":") + "::";
  }
  return ip;
}
