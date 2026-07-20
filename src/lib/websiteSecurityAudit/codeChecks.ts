import type { CodeFinding } from "./types";

// Mask a matched secret to a few boundary characters only — this function's output is the
// ONLY form a secret is ever allowed to take once found: it's what gets stored in the DB,
// shown in the dashboard, written to the PDF, and put in an email. The raw match itself is
// never persisted or logged anywhere.
// Capped regardless of match length — a long dangerous-function/SQL-concat match would
// otherwise mask to an equally long string of asterisks and overflow the
// WebsiteCodeFindings.MaskedEvidence NVARCHAR(500) column (seen live: a match over 500
// chars truncated at insert). The point of this field is to show *that* something matched
// and where, not to preserve full length.
const MAX_MASKED_INPUT_LENGTH = 80;

export function maskSecret(raw: string): string {
  const truncated = raw.length > MAX_MASKED_INPUT_LENGTH ? raw.slice(0, MAX_MASKED_INPUT_LENGTH) : raw;
  const masked =
    truncated.length <= 8 ? "*".repeat(truncated.length) : `${truncated.slice(0, 4)}${"*".repeat(Math.max(4, truncated.length - 8))}${truncated.slice(-4)}`;
  return raw.length > MAX_MASKED_INPUT_LENGTH ? `${masked}…` : masked;
}

interface SecretPattern {
  category: string;
  title: string;
  regex: RegExp;
}

// Heuristic regex patterns for common secret formats — the same class of approach used by
// widely-deployed lightweight secret scanners (e.g. gitleaks' default rules). This finds
// patterns, not guarantees; a secret in an unusual format can still slip through, and a
// pattern match is reported as "looks like," not confirmed to be a live/valid credential.
const SECRET_PATTERNS: SecretPattern[] = [
  { category: "hardcoded_secret", title: "Possible AWS access key", regex: /AKIA[0-9A-Z]{16}/g },
  { category: "hardcoded_secret", title: "Possible private key", regex: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/g },
  { category: "hardcoded_secret", title: "Possible generic API key/token assignment", regex: /(?:api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*["'][A-Za-z0-9_\-/.]{16,}["']/gi },
  { category: "hardcoded_secret", title: "Possible database connection string with credentials", regex: /(?:mongodb|postgres|mysql|redis):\/\/[^:\s]+:[^@\s]+@[^\s"'/]+/gi },
  { category: "hardcoded_secret", title: "Possible hardcoded password assignment", regex: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"'\s]{6,}["']/gi },
];

interface DangerousFunctionPattern {
  title: string;
  regex: RegExp;
  severity: CodeFinding["severity"];
  recommendation: string;
}

const DANGEROUS_FUNCTION_PATTERNS: DangerousFunctionPattern[] = [
  {
    title: "Use of eval()",
    regex: /\beval\s*\(/g,
    severity: "medium",
    recommendation: "Avoid eval() on any input that could be influenced by a user or external source.",
  },
  {
    title: "Unsanitized innerHTML assignment",
    regex: /\.innerHTML\s*=\s*(?!["'`]\s*["'`])/g,
    severity: "medium",
    recommendation: "Use textContent, or sanitize HTML before assigning to innerHTML, to reduce XSS risk.",
  },
  {
    title: "Unsanitized outerHTML assignment",
    regex: /\.outerHTML\s*=\s*(?!["'`]\s*["'`])/g,
    severity: "medium",
    recommendation: "Avoid assigning dynamic values to outerHTML; use safe DOM APIs or sanitize the HTML first.",
  },
  {
    title: "Use of document.write()",
    regex: /document\.write(?:ln)?\s*\(/g,
    severity: "low",
    recommendation: "Avoid document.write() — it can inject unsanitized markup and blocks streaming page rendering.",
  },
  {
    title: "postMessage listener without origin check",
    regex: /addEventListener\s*\(\s*["']message["']\s*,\s*(?:function|\([^)]*\)\s*=>)(?![\s\S]{0,120}\.origin)/g,
    severity: "medium",
    recommendation: "Validate event.origin against an allow-list inside every 'message' event listener before trusting the payload.",
  },
  {
    title: "Possible secret written to localStorage/sessionStorage",
    regex: /(?:localStorage|sessionStorage)\.setItem\s*\(\s*["'](?:token|secret|api[_-]?key|password)["']/gi,
    severity: "medium",
    recommendation: "Avoid storing tokens/secrets in localStorage/sessionStorage (readable by any script on the page); prefer an HttpOnly cookie.",
  },
  {
    title: "Possible string-concatenated SQL query",
    regex: /(?:SELECT|INSERT|UPDATE|DELETE)\s+.*["'`]\s*\+\s*\w+/gi,
    severity: "high",
    recommendation: "Use parameterized queries/prepared statements instead of building SQL via string concatenation.",
  },
  {
    title: "Use of exec()/child_process with dynamic input",
    regex: /\b(?:exec|execSync|spawn)\s*\(\s*[`'"]?\$\{|\bexec\s*\(\s*\w+\s*\+/g,
    severity: "high",
    recommendation: "Avoid passing dynamic/user-controlled values into a shell command; use an argument array instead of a concatenated string.",
  },
];

export function scanSourceForSecrets(source: string, location: string | null): CodeFinding[] {
  const findings: CodeFinding[] = [];
  for (const pattern of SECRET_PATTERNS) {
    for (const match of source.matchAll(pattern.regex)) {
      findings.push({
        category: pattern.category,
        severity: "critical",
        location,
        maskedEvidence: maskSecret(match[0]),
        recommendation: "Remove this secret from source control, rotate it immediately, and load it from an environment variable or secrets manager instead.",
      });
    }
  }
  for (const pattern of DANGEROUS_FUNCTION_PATTERNS) {
    for (const match of source.matchAll(pattern.regex)) {
      findings.push({
        category: "dangerous_function",
        severity: pattern.severity,
        location,
        maskedEvidence: maskSecret(match[0]),
        recommendation: pattern.recommendation,
      });
    }
  }
  return findings;
}

export async function scanClientBundlesForSecrets(pageUrl: string, html: string): Promise<CodeFinding[]> {
  const scriptSrcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
    .map((m) => m[1])
    .filter((src) => !src.startsWith("http") || src.startsWith(new URL(pageUrl).origin))
    .slice(0, 8); // cap how many bundles we fetch per scan — this is a lightweight check, not a full crawl

  const findings: CodeFinding[] = [];
  for (const src of scriptSrcs) {
    try {
      const scriptUrl = new URL(src, pageUrl).toString();
      const res = await fetch(scriptUrl, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const body = await res.text();
      findings.push(...scanSourceForSecrets(body, scriptUrl));
    } catch {
      // one bundle failing to fetch shouldn't fail the whole scan
    }
  }
  return findings;
}
