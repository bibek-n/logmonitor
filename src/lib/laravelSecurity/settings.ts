import { getDb } from "@/lib/db";
import type { EffectiveScanSettings, IssueSeverity } from "./types";

export interface ScanConfigOverrides {
  includedDirectories?: string[];
  excludedDirectories?: string[];
  enabledRuleCodes?: string[];
}

interface LaravelSecuritySettingsRow {
  WeightAppDebug: number;
  WeightAppKey: number;
  WeightDotEnv: number;
  WeightCsrf: number;
  WeightMassAssignment: number;
  WeightValidation: number;
  WeightSanitization: number;
  WeightStorageLinks: number;
  WeightQueue: number;
  PointsPerIssueLow: number;
  PointsPerIssueMedium: number;
  PointsPerIssueHigh: number;
  PointsPerIssueCritical: number;
  ExcludedDirectories: string | null;
  AllowedExtensions: string;
  MaxScanSizeMb: number;
  ScanTimeoutSeconds: number;
  RetentionDays: number;
}

// Merges the global LaravelSecuritySettings row with a scan's own overrides (from the Start
// Scan modal) into the single settings shape every analyzer reads. Mirrors codeQuality/
// settings.ts's loadEffectiveSettings() exactly.
export async function loadEffectiveSettings(overrides?: ScanConfigOverrides): Promise<EffectiveScanSettings> {
  const db = await getDb();
  const settingsResult = await db.query<LaravelSecuritySettingsRow>`SELECT * FROM LaravelSecuritySettings WHERE Id = 1`;
  const settings = settingsResult.recordset[0];
  if (!settings) throw new Error("LaravelSecuritySettings row is missing - run migrate:laravel-security.");

  const rulesResult = await db.query<{ RuleCode: string }>`SELECT RuleCode FROM LaravelSecurityRules WHERE Enabled = 1`;
  const enabledRuleCodes = new Set(overrides?.enabledRuleCodes && overrides.enabledRuleCodes.length > 0 ? overrides.enabledRuleCodes : rulesResult.recordset.map((r) => r.RuleCode));

  let excludedDirectories: string[] = [];
  try {
    excludedDirectories = JSON.parse(settings.ExcludedDirectories ?? "[]");
  } catch {
    excludedDirectories = [];
  }
  if (overrides?.excludedDirectories?.length) {
    excludedDirectories = Array.from(new Set([...excludedDirectories, ...overrides.excludedDirectories]));
  }

  return {
    excludedDirectories,
    allowedExtensions: settings.AllowedExtensions.split(",").map((s) => s.trim()).filter(Boolean),
    maxScanSizeMb: settings.MaxScanSizeMb,
    weights: {
      appDebug: settings.WeightAppDebug,
      appKey: settings.WeightAppKey,
      dotEnv: settings.WeightDotEnv,
      csrf: settings.WeightCsrf,
      massAssignment: settings.WeightMassAssignment,
      validation: settings.WeightValidation,
      sanitization: settings.WeightSanitization,
      storageLinks: settings.WeightStorageLinks,
      queue: settings.WeightQueue,
    },
    pointsPerSeverity: {
      low: settings.PointsPerIssueLow,
      medium: settings.PointsPerIssueMedium,
      high: settings.PointsPerIssueHigh,
      critical: settings.PointsPerIssueCritical,
    },
    enabledRuleCodes,
  };
}

export async function loadScanTimeoutSeconds(): Promise<number> {
  const db = await getDb();
  const result = await db.query<{ ScanTimeoutSeconds: number }>`SELECT ScanTimeoutSeconds FROM LaravelSecuritySettings WHERE Id = 1`;
  return result.recordset[0]?.ScanTimeoutSeconds ?? 1800;
}

// Issue severity is configurable per rule (LaravelSecurityRules.DefaultSeverity) - analyzers
// emit a reasonable default severity on their own, then the scan orchestrator remaps every
// issue's severity through this lookup before persisting, so changing a rule's severity in
// Settings takes effect on the next scan without touching analyzer code.
export async function loadRuleSeverities(): Promise<Map<string, IssueSeverity>> {
  const db = await getDb();
  const result = await db.query<{ RuleCode: string; DefaultSeverity: IssueSeverity }>`SELECT RuleCode, DefaultSeverity FROM LaravelSecurityRules`;
  return new Map(result.recordset.map((r) => [r.RuleCode, r.DefaultSeverity]));
}
