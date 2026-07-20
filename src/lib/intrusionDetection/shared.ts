// Types shared between the server-side collection/detection pipeline and client dashboard
// components. No server-only imports here (no `mssql`, no `fs`, no node builtins) so client
// components can import this file directly without pulling server code into the browser.

export type Severity = "informational" | "low" | "medium" | "high" | "critical";

export const SEVERITY_ORDER: Severity[] = ["informational", "low", "medium", "high", "critical"];

export function severityRank(s: Severity): number {
  return SEVERITY_ORDER.indexOf(s);
}

export type AlertStatus = "New" | "Investigating" | "Confirmed" | "FalsePositive" | "Resolved" | "Suppressed";

export const ALERT_STATUSES: AlertStatus[] = ["New", "Investigating", "Confirmed", "FalsePositive", "Resolved", "Suppressed"];

// One entry per detection category a starter rule can classify an event as. Kept as a
// plain string union (not an enum) so a new rule can introduce a new category value
// without a schema migration - SecurityAlerts.Category is a VARCHAR, not a CHECK-constrained
// list, specifically so the rule set can grow without a DDL change each time.
export type AttackCategory =
  | "sql_injection"
  | "xss"
  | "path_traversal"
  | "lfi_rfi"
  | "command_injection"
  | "ssrf"
  | "xxe"
  | "brute_force"
  | "credential_stuffing"
  | "excessive_auth_failures"
  | "suspicious_user_agent"
  | "scanner_signature"
  | "bot_activity"
  | "high_request_rate"
  | "repeated_error_responses"
  | "sensitive_file_access"
  | "admin_path_access"
  | "backup_config_exposure"
  | "unexpected_http_method"
  | "oversized_request"
  | "unusual_encoding"
  | "null_byte_encoding"
  | "suspicious_upload"
  | "blocked_ip"
  | "file_integrity"
  | "other";

export type AdapterType = "SophosThreat" | "SophosWebFilter" | "IisAccessLog" | "AdminAuditLog";

export type DataSource = "sophos_threat" | "sophos_webfilter" | "iis_access_log" | "admin_audit_log";

export interface SecurityEventRow {
  Id: number;
  LogSourceId: number | null;
  ProtectedApplicationId: number | null;
  DataSource: string;
  EventTime: string;
  SourceIp: string | null;
  DestinationHost: string | null;
  RequestMethod: string | null;
  RequestPath: string | null;
  ResponseStatus: number | null;
  UserAgent: string | null;
  UserAccount: string | null;
  EvidenceSummary: string | null;
  FieldsJson: string | null;
  AlertId: number | null;
  CreatedAt: string;
}

export interface AlertRow {
  Id: number;
  RuleId: number | null;
  ProtectedApplicationId: number | null;
  Category: string;
  Severity: Severity;
  Confidence: number;
  RiskScore: number;
  SourceIp: string | null;
  DestinationHost: string | null;
  RequestMethod: string | null;
  RequestPath: string | null;
  ResponseStatus: number | null;
  UserAgent: string | null;
  UserAccount: string | null;
  EvidenceSummary: string | null;
  RecommendedAction: string | null;
  Status: AlertStatus;
  GroupingKey: string;
  FirstSeenAt: string;
  LastSeenAt: string;
  OccurrenceCount: number;
  SuppressedUntil: string | null;
  CreatedAt: string;
  UpdatedAt: string;
  RuleName?: string | null;
}

export interface DetectionRuleRow {
  Id: number;
  RuleKey: string;
  Name: string;
  Description: string | null;
  Category: string;
  Severity: Severity;
  Confidence: number;
  DataSource: DataSource;
  Enabled: boolean;
  ConditionsJson: string;
  ExclusionsJson: string;
  ThresholdCount: number;
  ThresholdWindowSeconds: number;
  GroupingKeyTemplate: string;
  CooldownSeconds: number;
  Tags: string | null;
  RecommendedAction: string | null;
  Version: number;
}

// The event shape every log adapter produces, regardless of source. This is the contract
// between "collect logs" and "detect attacks" - the rule engine only ever looks at this
// shape, never at a raw Sophos/IIS line directly, so adding a new adapter never touches
// detection code.
export interface NormalizedSecurityEvent {
  logSourceId: number | null;
  protectedApplicationId: number | null;
  dataSource: DataSource;
  eventTime: string;
  sourceIp: string | null;
  destinationHost: string | null;
  requestMethod: string | null;
  requestPath: string | null;
  responseStatus: number | null;
  userAgent: string | null;
  userAccount: string | null;
  evidenceSummary: string | null;
  fields: Record<string, string | number | boolean | null>;
}

export interface DashboardStats {
  totalEvents: number;
  openAlerts: number;
  criticalAlerts: number;
  blockedIps: number;
  failedLogins24h: number;
  requestsPerMinute: number;
  topCategories: { category: string; count: number }[];
  topPaths: { path: string; count: number }[];
  topSourceIps: { ip: string; count: number }[];
  topRules: { ruleName: string; count: number }[];
  statusDistribution: { status: number; count: number }[];
  alertsOverTime: { bucket: string; count: number }[];
  collectorHealth: { name: string; status: string; lastRunAt: string | null; lastErrorMessage: string | null }[];
}
