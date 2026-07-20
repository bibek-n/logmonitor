import type { AttackCategory, Severity } from "./shared";
import type { RuleMatch } from "./ruleEngine";

// Documented, deterministic risk-scoring formula - every input and weight is named here so
// an alert's score is always explainable ("why is this 78?"), never an opaque ML output.
// All five inputs the spec calls for (severity, confidence, request frequency, historical
// activity, targeted resource) feed in; authentication status is folded into "targeted
// resource" for auth-category rules (an auth-abuse category IS the authentication signal).
//
//   riskScore = severityWeight * 0.35
//             + confidence     * 0.25
//             + frequencyBonus * 0.15   (rate-rule occurrence count, or repeat-pattern signal)
//             + historyBonus   * 0.15   (this source IP's prior confirmed/open alert count)
//             + categoryBonus  * 0.10   (how dangerous this attack category is if successful)
//
// Each term is pre-normalized to 0-100 before weighting, so the final score is always 0-100.

const SEVERITY_WEIGHT: Record<Severity, number> = {
  informational: 10,
  low: 30,
  medium: 55,
  high: 80,
  critical: 100,
};

// Categories where a successful hit is immediately high-impact (code execution, data
// exfiltration) score higher than reconnaissance-only categories, independent of the rule's
// own severity - two different rules at the same severity can still carry different
// intrinsic blast radius.
const CATEGORY_DANGER: Partial<Record<AttackCategory, number>> = {
  sql_injection: 100,
  command_injection: 100,
  lfi_rfi: 100,
  xxe: 90,
  ssrf: 85,
  credential_stuffing: 80,
  brute_force: 70,
  xss: 65,
  path_traversal: 65,
  backup_config_exposure: 60,
  sensitive_file_access: 55,
  excessive_auth_failures: 50,
  suspicious_upload: 50,
  unusual_encoding: 35,
  admin_path_access: 30,
  repeated_error_responses: 25,
  scanner_signature: 25,
  high_request_rate: 20,
  unexpected_http_method: 20,
  bot_activity: 15,
  other: 20,
};

export interface RiskScoreInput {
  severity: Severity;
  confidence: number;
  category: string;
  occurrenceCount?: number; // from a rate-rule match, if any
  priorAlertCountForIp: number; // SecurityIpProfiles.TotalAlerts for this source IP
}

export interface RiskScoreResult {
  score: number;
  breakdown: { severityWeight: number; confidenceWeight: number; frequencyBonus: number; historyBonus: number; categoryBonus: number };
}

export function computeRiskScore(input: RiskScoreInput): RiskScoreResult {
  const severityWeight = SEVERITY_WEIGHT[input.severity] ?? 50;
  const confidenceWeight = Math.max(0, Math.min(100, input.confidence));

  // A rate rule already implies repetition (occurrenceCount is the trigger itself); scale
  // it so hitting exactly the threshold gives a modest bonus and heavy overshoot saturates
  // at 100 rather than growing unbounded.
  const frequencyBonus = input.occurrenceCount ? Math.min(100, input.occurrenceCount * 4) : 0;

  // Repeat offenders (this IP has triggered alerts before) score higher - this is the
  // "historical activity" input the spec calls for.
  const historyBonus = Math.min(100, input.priorAlertCountForIp * 15);

  const categoryBonus = CATEGORY_DANGER[input.category as AttackCategory] ?? 30;

  const score = Math.round(severityWeight * 0.35 + confidenceWeight * 0.25 + frequencyBonus * 0.15 + historyBonus * 0.15 + categoryBonus * 0.1);

  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown: { severityWeight, confidenceWeight, frequencyBonus, historyBonus, categoryBonus },
  };
}

export function explainRiskScore(result: RiskScoreResult): string {
  const b = result.breakdown;
  return `Severity ${b.severityWeight}×0.35 + Confidence ${b.confidenceWeight}×0.25 + Frequency ${b.frequencyBonus}×0.15 + History ${b.historyBonus}×0.15 + Category ${b.categoryBonus}×0.10 = ${result.score}`;
}

export function buildEvidenceSummary(match: RuleMatch, eventEvidence: string | null): string {
  const parts = [match.reason];
  if (eventEvidence) parts.push(`Evidence: ${eventEvidence}`);
  return parts.join(" | ");
}
