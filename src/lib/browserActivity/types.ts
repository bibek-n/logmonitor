export type BrowserName = "chrome" | "edge" | "firefox";
export type RiskLevel = "none" | "low" | "medium" | "high" | "blocked";
export type SecurityEventType = "phishing" | "malware" | "blocked_domain" | null;
export type ExcludedDomainReason = "personal" | "medical" | "banking" | "union" | "legal" | "other";
export type CategoryMatchType = "exact" | "suffix";

// Raw shape the agent sends — deliberately narrow. No full URL, no query string, no fragment:
// the agent derives the bare domain and discards everything else before this struct exists.
export interface RawBrowserActivityEvent {
  browser: BrowserName;
  domain: string;
  pageTitle: string | null;
  visitedAt: string; // ISO 8601 UTC
  dwellSeconds: number | null;
}

export interface BrowserActivityEvent {
  id: number;
  deviceId: string;
  staffId: number | null;
  browser: BrowserName;
  domain: string;
  pageTitle: string | null;
  visitedAt: Date;
  dwellSeconds: number | null;
  categoryId: number | null;
  categoryName: string | null;
  riskLevel: RiskLevel;
  isSecurityEvent: boolean;
  securityEventType: SecurityEventType;
  receivedAt: Date;
}

export interface DomainCategory {
  id: number;
  name: string;
  riskLevel: RiskLevel;
  isBuiltIn: boolean;
}

export interface DomainCategoryRule {
  id: number;
  domain: string;
  categoryId: number;
  matchType: CategoryMatchType;
  source: "manual" | "seed" | "threat_intel";
}

export interface ExcludedDomain {
  id: number;
  domain: string;
  reason: ExcludedDomainReason;
  notes: string | null;
}

export interface BrowserActivitySettings {
  retentionDays: number;
  collectPageTitles: boolean;
  defaultIntervalMinutes: number;
}
