import type { SchemaSnapshot, Finding } from "../types";

// Column-name pattern detection only, by design - this never selects actual row data, so a
// read-only scan can flag "this table probably holds PII" without ever touching the PII
// itself. Phase 2 can add real value-sampling for a stronger signal.
const SENSITIVE_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /e[-_]?mail/i, label: "email address" },
  { pattern: /phone|mobile|contact_?no|telephone/i, label: "phone number" },
  { pattern: /ssn|social_?security/i, label: "social security number" },
  { pattern: /passport/i, label: "passport number" },
  { pattern: /national_?id|citizen_?id|aadhaar|pan_?card/i, label: "national ID" },
  { pattern: /credit_?card|card_?number|cc_?num/i, label: "credit card number" },
  { pattern: /date_?of_?birth|\bdob\b|birth_?date/i, label: "date of birth" },
  { pattern: /^address$|street_?address|home_?address/i, label: "physical address" },
];

export function runSensitiveDataRules(schema: SchemaSnapshot): Finding[] {
  const findings: Finding[] = [];

  for (const table of schema.tables) {
    for (const column of table.columns) {
      for (const { pattern, label } of SENSITIVE_PATTERNS) {
        if (!pattern.test(column.name)) continue;
        findings.push({
          category: "sensitive-data",
          severity: "info",
          title: `"${table.name}.${column.name}" looks like it stores a ${label}`,
          detail: "Flagged by column name only - this scan never reads the actual values.",
          affectedObject: `${table.name}.${column.name}`,
          recommendation: `Confirm whether "${table.name}.${column.name}" needs encryption at rest, access logging, or masking in reports/exports, per your data classification policy.`,
        });
        break; // one label per column is enough
      }
    }
  }

  return findings;
}
