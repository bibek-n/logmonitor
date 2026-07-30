export type MonitorType = "Website" | "Api";
export type MonitorStatus = "Up" | "Down" | "Degraded" | "Paused" | "Maintenance" | "Unknown" | "Pending";
export type IncidentSeverity = "Low" | "Medium" | "High" | "Critical";
export type IncidentStatus = "Open" | "Investigating" | "Identified" | "Monitoring" | "Resolved" | "Closed";
export type HttpMethodWebsite = "GET" | "HEAD";

export interface WebsiteMonitorConfig {
  monitorId: number;
  url: string;
  httpMethod: HttpMethodWebsite;
  expectedStatusCode: number;
  followRedirects: boolean;
  maxRedirects: number;
  sslVerify: boolean;
  expectedKeyword: string | null;
  forbiddenKeyword: string | null;
  responseTimeWarningMs: number;
  responseTimeCriticalMs: number;
  alertEmail: string | null;
}

export interface ContentCheckResult {
  passed: boolean;
  expectedKeywordFound: boolean | null; // null = no rule configured
  forbiddenKeywordFound: boolean | null;
  reason: string | null;
}

export interface SslCertificateInfo {
  domain: string | null;
  issuer: string | null;
  subject: string | null;
  validFrom: Date | null;
  expiresAt: Date | null;
  hostnameMatch: boolean | null;
  chainValid: boolean | null;
  selfSigned: boolean | null;
  tlsProtocol: string | null;
  signatureAlgorithm: string | null;
}

export interface WebsiteCheckResult {
  success: boolean;
  httpStatusCode: number | null;
  dnsMs: number | null;
  tcpMs: number | null;
  tlsMs: number | null;
  ttfbMs: number | null;
  totalMs: number | null;
  responseSizeBytes: number | null;
  redirectCount: number | null;
  finalUrl: string | null;
  contentCheck: ContentCheckResult | null;
  ssl: SslCertificateInfo | null;
  errorCode: string | null;
  errorMessage: string | null;
  // True when the response looks like a WAF/anti-bot challenge page (Cloudflare, Sucuri, a
  // generic Captcha wall) rather than the site's real content — see wafChallengeDetector.ts.
  // Drives an extended backoff in the scan script instead of retrying at the normal interval,
  // which is what actually caused this app's own IP to be blocked on a real site.
  wafChallengeDetected: boolean;
}

export interface MonitorCheckLimits {
  timeoutMs: number;
  maxRedirects: number;
  maxResponseBytes: number;
}

// --- API Monitors (Phase 2) ---

export type ApiHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
export type ApiAuthType = "None" | "ApiKey" | "BearerToken" | "BasicAuth" | "OAuth2ClientCredentials";
export type ApiKeyLocation = "header" | "query";
export type ApiAssertionOperator = "equals" | "notEquals" | "contains" | "notContains" | "exists" | "notExists" | "greaterThan" | "lessThan" | "matchesRegex";

export interface ApiHeader {
  key: string;
  value: string;
}

// Discriminated union of the decrypted (plaintext) auth secret shape - this is what ever
// touches the real credential value; ApiMonitorConfigs.AuthConfigEncrypted stores exactly this
// object, JSON-stringified then AES-256-GCM encrypted (see apiCredentials.ts). Never sent to
// the browser in this shape - API responses substitute a masked placeholder for every secret
// field instead (see maskApiAuthConfig in schema.ts).
export type ApiAuthConfig =
  | { type: "None" }
  | { type: "ApiKey"; keyLocation: ApiKeyLocation; keyName: string; keyValue: string }
  | { type: "BearerToken"; token: string }
  | { type: "BasicAuth"; username: string; password: string }
  | { type: "OAuth2ClientCredentials"; tokenUrl: string; clientId: string; clientSecret: string; scope: string | null };

export interface ApiAssertion {
  // Dot/bracket path into the parsed JSON response body, e.g. "data.items[0].id" or "$.status"
  // (a leading "$." is optional and stripped) - see jsonPath.ts for exactly what's supported.
  path: string;
  operator: ApiAssertionOperator;
  expectedValue: string | null; // unused for exists/notExists
}

export interface ApiAssertionResult extends ApiAssertion {
  actualValue: string | null;
  passed: boolean;
  reason: string | null;
}

export interface ApiMonitorConfig {
  monitorId: number;
  url: string;
  httpMethod: ApiHttpMethod;
  headers: ApiHeader[];
  queryParams: ApiHeader[];
  requestBody: string | null;
  requestBodyContentType: string | null;
  authType: ApiAuthType;
  authConfig: ApiAuthConfig; // decrypted, in-memory only - see repository.ts for load/save
  expectedStatusCode: number;
  followRedirects: boolean;
  maxRedirects: number;
  sslVerify: boolean;
  assertions: ApiAssertion[];
  responseTimeWarningMs: number;
  responseTimeCriticalMs: number;
  alertEmail: string | null;
}

export interface ApiCheckResult {
  success: boolean;
  httpStatusCode: number | null;
  dnsMs: number | null;
  tcpMs: number | null;
  tlsMs: number | null;
  ttfbMs: number | null;
  totalMs: number | null;
  responseSizeBytes: number | null;
  redirectCount: number | null;
  finalUrl: string | null;
  assertionResults: ApiAssertionResult[];
  errorCode: string | null;
  errorMessage: string | null;
  // See WebsiteCheckResult.wafChallengeDetected — identical purpose for API monitors.
  wafChallengeDetected: boolean;
}

// --- Phase 3: alert channels, escalation, quiet hours, maintenance, incident workflow ---

export type AlertContactType = "Email" | "Slack" | "Teams" | "Webhook" | "InApp";

// Non-secret, channel-specific extras that don't fit the single Destination string - stored as
// AlertContacts.ConfigJson. Slack/Teams have nothing extra today (Destination is the webhook
// URL); Webhook optionally signs its payload; InApp's Destination is a Users.Username.
export interface WebhookContactConfig {
  signingSecret?: string | null;
}

export interface AlertEscalationStep {
  id: number;
  alertPolicyId: number;
  stepOrder: number;
  delayMinutes: number;
  contactIds: number[];
}

export interface MaintenanceWindow {
  id: number;
  name: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  isRecurring: boolean;
  recurrenceRule: "Daily" | "Weekly" | "Monthly" | null;
  isActive: boolean;
  monitorIds: number[];
}

export interface IncidentNote {
  id: number;
  incidentId: number;
  userId: number;
  username: string | null;
  note: string;
  createdAt: string;
}

export interface InAppNotification {
  id: number;
  userId: number;
  eventType: string | null;
  subject: string | null;
  body: string | null;
  monitorId: number | null;
  incidentId: number | null;
  isRead: boolean;
  createdAt: string;
}
