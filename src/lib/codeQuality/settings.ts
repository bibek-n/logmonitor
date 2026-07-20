import { getDb } from "@/lib/db";
import type { EffectiveScanSettings, IssueSeverity } from "./types";

export interface ScanConfigOverrides {
  includedDirectories?: string[];
  excludedDirectories?: string[];
  complexityThreshold?: number;
  duplicationThreshold?: number;
  enabledRuleCodes?: string[];
}

interface CodeQualitySettingsRow {
  ComplexityLowMax: number;
  ComplexityMediumMax: number;
  ComplexityHighMax: number;
  DuplicationThresholdPercent: number;
  MinDuplicateBlockSize: number;
  MaxLineLength: number;
  WeightComplexity: number;
  WeightDuplication: number;
  WeightDeadCode: number;
  WeightUnusedVariables: number;
  WeightUnusedFunctions: number;
  WeightCodingStandards: number;
  ScaleComplexity: number;
  ScaleDuplication: number;
  ScaleDeadCode: number;
  ScaleUnusedVariables: number;
  ScaleUnusedFunctions: number;
  ScaleCodingStandards: number;
  ExcludedDirectories: string | null;
  AllowedExtensions: string;
  MaxScanSizeMb: number;
  ScanTimeoutSeconds: number;
  RetentionDays: number;
}

// Merges the global CodeQualitySettings row with a scan's own overrides (from the Start Scan
// modal - see the API route) into the single settings shape every analyzer reads. Analyzers
// never touch the DB or know about "global vs. per-scan" - this is the only place that
// distinction exists.
export async function loadEffectiveSettings(overrides?: ScanConfigOverrides): Promise<EffectiveScanSettings> {
  const db = await getDb();
  const settingsResult = await db.query<CodeQualitySettingsRow>`SELECT * FROM CodeQualitySettings WHERE Id = 1`;
  const settings = settingsResult.recordset[0];
  if (!settings) throw new Error("CodeQualitySettings row is missing - run migrate:code-quality.");

  const rulesResult = await db.query<{ RuleCode: string }>`SELECT RuleCode FROM CodeQualityRules WHERE Enabled = 1`;
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
    complexityLowMax: overrides?.complexityThreshold ?? settings.ComplexityLowMax,
    complexityMediumMax: settings.ComplexityMediumMax,
    complexityHighMax: settings.ComplexityHighMax,
    duplicationThresholdPercent: overrides?.duplicationThreshold ?? settings.DuplicationThresholdPercent,
    minDuplicateBlockSize: settings.MinDuplicateBlockSize,
    maxLineLength: settings.MaxLineLength,
    excludedDirectories,
    allowedExtensions: settings.AllowedExtensions.split(",").map((s) => s.trim()).filter(Boolean),
    maxScanSizeMb: settings.MaxScanSizeMb,
    weights: {
      complexity: settings.WeightComplexity,
      duplication: settings.WeightDuplication,
      deadCode: settings.WeightDeadCode,
      unusedVariables: settings.WeightUnusedVariables,
      unusedFunctions: settings.WeightUnusedFunctions,
      codingStandards: settings.WeightCodingStandards,
    },
    scales: {
      complexity: settings.ScaleComplexity,
      duplication: settings.ScaleDuplication,
      deadCode: settings.ScaleDeadCode,
      unusedVariables: settings.ScaleUnusedVariables,
      unusedFunctions: settings.ScaleUnusedFunctions,
      codingStandards: settings.ScaleCodingStandards,
    },
    enabledRuleCodes,
  };
}

export async function loadScanTimeoutSeconds(): Promise<number> {
  const db = await getDb();
  const result = await db.query<{ ScanTimeoutSeconds: number }>`SELECT ScanTimeoutSeconds FROM CodeQualitySettings WHERE Id = 1`;
  return result.recordset[0]?.ScanTimeoutSeconds ?? 1800;
}

// Issue category/rule severity is configurable per rule (CodeQualityRules.DefaultSeverity) -
// analyzers emit a reasonable default severity on their own, then the scan orchestrator
// remaps every issue's severity through this lookup before persisting, so changing a rule's
// severity in Settings takes effect on the next scan without touching analyzer code.
export async function loadRuleSeverities(): Promise<Map<string, IssueSeverity>> {
  const db = await getDb();
  const result = await db.query<{ RuleCode: string; DefaultSeverity: IssueSeverity }>`SELECT RuleCode, DefaultSeverity FROM CodeQualityRules`;
  return new Map(result.recordset.map((r) => [r.RuleCode, r.DefaultSeverity]));
}
