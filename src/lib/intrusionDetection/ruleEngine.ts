import { getDb, sql } from "@/lib/db";
import type { DetectionRuleRow, NormalizedSecurityEvent } from "./shared";
import type { FieldMatch, RuleConditions } from "./ruleTypes";

export interface RuleMatch {
  rule: DetectionRuleRow;
  reason: string;
  matchedPattern?: string;
  occurrenceCount?: number; // rate rules only - how many qualifying events were in the window
}

interface ExclusionSet {
  ips: Set<string>;
  paths: RegExp[];
  userAgents: RegExp[];
}

export async function loadExclusions(): Promise<ExclusionSet> {
  const db = await getDb();
  const result = await db.query<{ ExclusionType: string; Value: string }>(`SELECT ExclusionType, Value FROM SecurityRuleExclusions`);
  const allowlist = await db.query<{ IpOrCidr: string }>(`SELECT IpOrCidr FROM SecurityIpAllowlist WHERE ExpiresAt IS NULL OR ExpiresAt > SYSUTCDATETIME()`);

  const ips = new Set<string>();
  const paths: RegExp[] = [];
  const userAgents: RegExp[] = [];

  for (const row of result.recordset) {
    if (row.ExclusionType === "IP") ips.add(row.Value);
    else if (row.ExclusionType === "Path") paths.push(new RegExp(row.Value, "i"));
    else if (row.ExclusionType === "UserAgent") userAgents.push(new RegExp(row.Value, "i"));
  }
  for (const row of allowlist.recordset) ips.add(row.IpOrCidr);

  return { ips, paths, userAgents };
}

// Never automatically act on an allowlisted IP, excluded path, or excluded user agent -
// this is the "false-positive control" gate every rule passes through before evaluation.
export function isExcluded(event: NormalizedSecurityEvent, exclusions: ExclusionSet): boolean {
  if (event.sourceIp && exclusions.ips.has(event.sourceIp)) return true;
  if (event.requestPath && exclusions.paths.some((re) => re.test(event.requestPath!))) return true;
  if (event.userAgent && exclusions.userAgents.some((re) => re.test(event.userAgent!))) return true;
  return false;
}

function resolveField(event: NormalizedSecurityEvent, field: string): unknown {
  if (field.startsWith("fields.")) return event.fields?.[field.slice("fields.".length)];
  return (event as unknown as Record<string, unknown>)[field];
}

function fieldMatchPasses(event: NormalizedSecurityEvent, match: FieldMatch): boolean {
  const actual = resolveField(event, match.field);
  if (actual === null || actual === undefined) return false;
  switch (match.operator) {
    case "equals":
      return String(actual).toLowerCase() === String(match.value).toLowerCase();
    case "in":
      return Array.isArray(match.value) && match.value.some((v) => String(v).toLowerCase() === String(actual).toLowerCase());
    case "gte":
      return Number(actual) >= Number(match.value);
    case "lte":
      return Number(actual) <= Number(match.value);
    default:
      return false;
  }
}

function getPatternFieldValue(event: NormalizedSecurityEvent, field: string | undefined): string | null {
  if (!field) return null;
  const value = (event as unknown as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}

// Pattern rules match a single event in isolation - no DB round trip needed, so the
// collector can call this for every event synchronously during ingestion.
export function evaluatePatternRule(rule: DetectionRuleRow, event: NormalizedSecurityEvent): RuleMatch | null {
  const conditions: RuleConditions = JSON.parse(rule.ConditionsJson);
  if (conditions.dataSource !== "any" && conditions.dataSource !== event.dataSource) return null;

  let matchedPattern: string | undefined;
  if (conditions.patterns && conditions.patterns.length > 0) {
    const fieldValue = getPatternFieldValue(event, conditions.patternField);
    if (!fieldValue) return null;
    const hit = conditions.patterns.find((p) => {
      try {
        return new RegExp(p, "i").test(fieldValue);
      } catch {
        return false; // A malformed regex (e.g. hand-edited via the future rule API) never crashes the engine.
      }
    });
    if (!hit) return null;
    matchedPattern = hit;
  }

  if (conditions.fieldMatches && conditions.fieldMatches.length > 0) {
    if (!conditions.fieldMatches.every((fm) => fieldMatchPasses(event, fm))) return null;
  }

  const fieldDescription = conditions.patternField ? ` in ${conditions.patternField}` : "";
  const reason = matchedPattern
    ? `Matched pattern${fieldDescription}: /${matchedPattern}/`
    : `Matched rule conditions on ${conditions.fieldMatches?.map((f) => f.field).join(", ")}`;

  return { rule, reason, matchedPattern };
}

// Rate rules need historical context: how many qualifying events has this groupBy key
// (usually the source IP) produced in the trailing window, including the event that just
// arrived. Implemented as one indexed COUNT query rather than in-memory tracking, since
// SecurityEvents is already the durable record and this keeps the engine stateless between
// collector runs (a restart doesn't lose in-flight counters).
export async function evaluateRateRule(rule: DetectionRuleRow, event: NormalizedSecurityEvent): Promise<RuleMatch | null> {
  const conditions: RuleConditions = JSON.parse(rule.ConditionsJson);
  if (conditions.dataSource !== "any" && conditions.dataSource !== event.dataSource) return null;
  if (conditions.fieldMatches && !conditions.fieldMatches.every((fm) => fieldMatchPasses(event, fm))) return null;

  const groupBy = conditions.groupBy ?? "sourceIp";
  const groupValue = groupBy === "sourceIp" ? event.sourceIp : event.userAccount;
  if (!groupValue) return null;

  const db = await getDb();
  const request = db
    .request()
    .input("windowStart", sql.DateTime2, new Date(Date.now() - rule.ThresholdWindowSeconds * 1000))
    .input("groupValue", sql.NVarChar, groupValue);

  const groupColumn = groupBy === "sourceIp" ? "SourceIp" : "UserAccount";
  let whereExtra = "";
  if (conditions.dataSource !== "any") {
    request.input("dataSource", sql.VarChar, conditions.dataSource);
    whereExtra += " AND DataSource = @dataSource";
  }
  if (conditions.fieldMatches) {
    for (const fm of conditions.fieldMatches) {
      if (fm.field === "responseStatus" && fm.operator === "equals") {
        request.input(`rs`, sql.Int, Number(fm.value));
        whereExtra += " AND ResponseStatus = @rs";
      } else if (fm.field === "responseStatus" && fm.operator === "in" && Array.isArray(fm.value)) {
        const inList = fm.value.map((v) => Number(v));
        whereExtra += ` AND ResponseStatus IN (${inList.join(",")})`;
      } else if (fm.field === "fields.success" && fm.operator === "equals") {
        // FieldsJson stores {"success":true|false} - JSON_VALUE returns "true"/"false" text.
        request.input("successVal", sql.VarChar, String(fm.value));
        whereExtra += " AND JSON_VALUE(FieldsJson, '$.success') = @successVal";
      }
      // Other field-match shapes aren't needed by the starter rule set's rate rules; a
      // future custom rate rule using an unsupported fieldMatch simply won't narrow the
      // count further (still correct, just less selective) rather than erroring.
    }
  }

  const result = await request.query<{ Cnt: number }>(`
    SELECT COUNT(*) AS Cnt FROM SecurityEvents
    WHERE EventTime >= @windowStart AND ${groupColumn} = @groupValue ${whereExtra}
  `);

  const count = result.recordset[0].Cnt + 1; // +1 for the just-arrived event, not yet persisted at evaluation time.
  if (count < rule.ThresholdCount) return null;

  return {
    rule,
    reason: `${count} matching events from ${groupBy === "sourceIp" ? "IP " + groupValue : "account " + groupValue} within ${rule.ThresholdWindowSeconds}s (threshold: ${rule.ThresholdCount})`,
    occurrenceCount: count,
  };
}

export async function evaluateRulesForEvent(event: NormalizedSecurityEvent, rules: DetectionRuleRow[], exclusions: ExclusionSet): Promise<RuleMatch[]> {
  if (isExcluded(event, exclusions)) return [];

  const matches: RuleMatch[] = [];
  for (const rule of rules) {
    if (!rule.Enabled) continue;
    const conditions: RuleConditions = JSON.parse(rule.ConditionsJson);
    const match = conditions.type === "pattern" ? evaluatePatternRule(rule, event) : await evaluateRateRule(rule, event);
    if (match) matches.push(match);
  }
  return matches;
}

export async function loadEnabledRules(): Promise<DetectionRuleRow[]> {
  const db = await getDb();
  const result = await db.query<Omit<DetectionRuleRow, "Enabled"> & { Enabled: number }>(`
    SELECT Id, RuleKey, Name, Description, Category, Severity, Confidence, DataSource, Enabled, ConditionsJson, ExclusionsJson, ThresholdCount, ThresholdWindowSeconds, GroupingKeyTemplate, CooldownSeconds, Tags, RecommendedAction, Version
    FROM SecurityDetectionRules
    WHERE Enabled = 1
  `);
  return result.recordset.map((r) => ({ ...r, Enabled: Boolean(r.Enabled) }));
}
