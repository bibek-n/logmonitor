import type { SchemaSnapshot, ConnectionConfig, Finding } from "../types";

// Administrative-sounding account names for the three supported engines - connecting with
// one of these for routine analysis is itself a finding, regardless of what else the scan
// sees, since it implies this app (or whoever set up the connection) is holding more
// privilege than a read-only structure scan needs.
const PRIVILEGED_USERNAMES = ["sa", "root", "admin", "administrator", "postgres", "superuser"];

// Column names that strongly suggest a secret/password field - if its stored max length is
// short, that's a real (if indirect) signal it's not holding a proper bcrypt/argon2/scrypt
// hash (which run 60-97 characters), i.e. a plaintext-or-weakly-hashed password column.
const SECRET_COLUMN_PATTERN = /password|passwd|pwd|secret|api_?key/i;
const PLAINTEXT_LENGTH_THRESHOLD = 55;

// config is null for an uploaded .sql file scan - there's no real connection/username to
// judge, so that check is skipped; the column-name heuristic below still applies either way.
export function runSecurityRules(schema: SchemaSnapshot, config: ConnectionConfig | null): Finding[] {
  const findings: Finding[] = [];

  if (config && PRIVILEGED_USERNAMES.includes(config.username.toLowerCase())) {
    findings.push({
      category: "security",
      severity: "high",
      title: `Connected using a privileged-looking account ("${config.username}")`,
      detail: "Routine structure/security scanning doesn't need administrative rights - using one here means a leaked or misused credential has far more blast radius than necessary.",
      recommendation: "Create a dedicated, read-only account for this connection (SELECT on information_schema/catalog views only) instead of reusing an admin/root/sa account.",
    });
  }

  for (const table of schema.tables) {
    for (const column of table.columns) {
      if (!SECRET_COLUMN_PATTERN.test(column.name)) continue;
      if (column.maxLength != null && column.maxLength > 0 && column.maxLength < PLAINTEXT_LENGTH_THRESHOLD) {
        findings.push({
          category: "security",
          severity: "high",
          title: `"${table.name}.${column.name}" looks too short to hold a proper password hash`,
          detail: `Max length is ${column.maxLength} characters - bcrypt/argon2/scrypt hashes are typically 60+ characters, so this column is likely storing plaintext or a weak/truncated hash.`,
          affectedObject: `${table.name}.${column.name}`,
          recommendation: "Store passwords only as a modern, salted hash (bcrypt, argon2, or scrypt) and widen the column to fit (at least VARCHAR(97)).",
        });
      }
    }
  }

  return findings;
}
