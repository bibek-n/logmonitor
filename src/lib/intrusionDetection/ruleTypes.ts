import type { AttackCategory, DataSource, Severity } from "./shared";

// The maintainable rule format (spec calls for YAML or JSON - this is the JSON variant,
// stored as ConditionsJson on SecurityDetectionRules and defined here in code as the
// canonical, version-controlled source of truth for the starter set). A rule is one of two
// kinds:
//
//   "pattern" - regex-match a single event's field(s). Fires immediately, per event.
//   "rate"    - count how many of THIS rule's own pattern-matches (or, if no pattern is
//               given, how many events matching fieldMatches) the same groupBy key has
//               produced within ThresholdWindowSeconds; fires once ThresholdCount is hit.
//               Rate rules are how brute-force/credential-stuffing/high-request-rate/
//               repeated-error-code detection work - a single failed login isn't an alert,
//               20 of them from one IP in 5 minutes is.
export type RuleConditionType = "pattern" | "rate";

export type PatternField = "requestPath" | "userAgent" | "evidenceSummary" | "userAccount" | "requestMethod";

export interface FieldMatch {
  // A top-level NormalizedSecurityEvent key (e.g. "responseStatus", "requestMethod"), or
  // "fields.<key>" to reach into that event's adapter-specific `fields` bag (e.g.
  // "fields.success", "fields.action", "fields.severity").
  field: string;
  operator: "equals" | "in" | "gte" | "lte";
  value: string | number | boolean | (string | number)[];
}

export interface RuleConditions {
  type: RuleConditionType;
  dataSource: DataSource | "any";
  patternField?: PatternField;
  // Regex source strings, OR'd together - any one matching is a hit. Kept as plain strings
  // (not RegExp objects) so they round-trip through JSON/DB storage and the future rule-
  // management API without a serialization layer.
  patterns?: string[];
  fieldMatches?: FieldMatch[];
  // Rate rules group counts by this key (usually "sourceIp", sometimes "userAccount").
  groupBy?: "sourceIp" | "userAccount";
}

export interface StarterRule {
  ruleKey: string;
  name: string;
  description: string;
  category: AttackCategory;
  severity: Severity;
  confidence: number;
  dataSource: DataSource | "any";
  conditions: RuleConditions;
  thresholdCount: number;
  thresholdWindowSeconds: number;
  cooldownSeconds: number;
  tags: string[];
  recommendedAction: string;
  references: string[];
}
