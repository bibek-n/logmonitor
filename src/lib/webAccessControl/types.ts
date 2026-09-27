// Shared types for the Web Access Control module — mirrors the columns created by
// scripts/migrate-web-access-control.ts (WacGroups, WacSchedules, WacWebsiteRules,
// WacCriticalAllowlist). Kept separate from the DB row shapes (PascalCase, as returned
// directly by mssql) so the pure rulesEngine can work with a normalized camelCase shape
// that API routes map DB rows into.

export type WacMatchType = "exact" | "suffix";
export type WacAction = "Allow" | "Block";
export type WacScopeType = "Staff" | "Group" | "Global";
export type WacPriority = "Low" | "Normal" | "High";
export type WacStatus = "Enabled" | "Disabled";

export interface WacGroup {
  id: number;
  name: string;
  description: string | null;
  isBuiltIn: boolean;
}

export interface WacSchedule {
  id: number;
  name: string;
  // Comma-separated day abbreviations, e.g. "Mon,Tue,Wed,Thu,Fri" — null/empty means "every
  // day" (only relevant when startTime/endTime are also set; a schedule with none of the
  // three fields set means "Always", same as the built-in seeded row).
  daysOfWeek: string | null;
  // "HH:MM" (24h, server-local — see rulesEngine.ts for the timezone caveat).
  startTime: string | null;
  endTime: string | null;
  isBuiltIn: boolean;
}

export interface WacWebsiteRule {
  id: number;
  domain: string;
  matchType: WacMatchType;
  action: WacAction;
  scopeType: WacScopeType;
  staffId: number | null;
  wacGroupId: number | null;
  scheduleId: number | null;
  priority: WacPriority;
  status: WacStatus;
  // ISO timestamp — used only as the final tie-break ("most-recently-updated wins") when two
  // group-tier rules of equal Priority genuinely conflict.
  updatedAt: string;
}

export interface WacCriticalAllowlistEntry {
  id: number;
  serviceName: string;
  domain: string | null;
  ipAddress: string | null;
  port: number | null;
  matchType: WacMatchType;
  isCritical: boolean;
}

export type WacTier = "CriticalAllowlist" | "StaffAllow" | "StaffBlock" | "Group" | "GlobalPolicy" | "DefaultPolicy";

export type WacMatchedRule = WacWebsiteRule | WacCriticalAllowlistEntry | null;

export interface WacResolution {
  decision: WacAction;
  tier: WacTier;
  matchedRule: WacMatchedRule;
  // Populated only for the "Group" tier when a staff member's group has both a matching
  // Allow rule and a matching Block rule for the same domain — every conflicting rule
  // involved, so the UI can render a warning instead of the caller silently trusting
  // `decision`.
  conflicts: WacWebsiteRule[];
}
