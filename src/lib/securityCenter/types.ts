export type VulnerabilitySeverity = "Critical" | "High" | "Medium" | "Low" | "Informational";
export type VulnerabilityScanStatus = "Pending" | "Running" | "Completed" | "Failed";
export type VulnerabilityFindingStatus = "Open" | "Confirmed" | "FalsePositive" | "Resolved" | "Accepted";

// The 12 safe, non-destructive, black-box checks Phase 1 ships - see the approved plan for why
// each is scoped this way (no exploitation, no credential attempts, no blind/time-based
// payloads that could stress a production system).
export type VulnerabilityCheckType =
  | "MissingSecurityHeaders"
  | "WeakSslTlsConfiguration"
  | "CookieSecurity"
  | "CorsMisconfiguration"
  | "OpenRedirect"
  | "Clickjacking"
  | "DirectoryListing"
  | "InformationDisclosure"
  | "DebugModeDetection"
  | "ReflectedXss"
  | "SqlInjectionErrorBased"
  | "ExposedAdminInterface";

export interface VulnerabilityFindingDraft {
  checkType: VulnerabilityCheckType;
  severity: VulnerabilitySeverity;
  cvssScore: number | null;
  cwe: string | null;
  cve: string | null;
  title: string;
  description: string;
  risk: string;
  evidence: string;
  affectedUrl: string;
  parameter: string | null;
  httpRequestSnippet: string | null;
  httpResponseSnippet: string | null;
  remediation: string;
  references: string[];
}

export interface VulnerabilityFinding extends VulnerabilityFindingDraft {
  id: number;
  scanId: number;
  status: VulnerabilityFindingStatus;
  assignedEngineerUserId: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VulnerabilityScan {
  id: number;
  websiteId: number | null;
  targetUrl: string;
  isAdHocTarget: boolean;
  authorizedByUserId: number | null;
  status: VulnerabilityScanStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  checksRun: number;
  requestedByUserId: number | null;
  createdAt: Date;
  findings?: VulnerabilityFinding[];
}

export type WafRuleAction = "Block" | "Challenge" | "LogOnly";
export type WafCustomRuleAction = "Block" | "Allow" | "LogOnly";
export type WafCustomRuleMatchType = "UrlPattern" | "UserAgentPattern" | "HeaderPattern";

export interface WafRateLimitRule {
  id: number;
  websiteId: number | null;
  name: string;
  requestsPerWindow: number;
  windowSeconds: number;
  action: WafRuleAction;
  isActive: boolean;
  createdAt: Date;
}

export interface WafCustomRule {
  id: number;
  name: string;
  matchType: WafCustomRuleMatchType;
  matchValue: string;
  action: WafCustomRuleAction;
  isActive: boolean;
  createdAt: Date;
}

export interface WafCountryRule {
  id: number;
  countryCode: string;
  action: "Block" | "Allow";
  isActive: boolean;
  createdAt: Date;
}
