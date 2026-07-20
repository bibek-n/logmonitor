import type { EffectiveScanSettings, SourceFile } from "./types";

export function makeSourceFile(relativePath: string, content: string): SourceFile {
  return {
    absolutePath: `/repo/${relativePath}`,
    relativePath,
    content,
    lines: content.split(/\r\n|\r|\n/),
  };
}

// Mirrors the seeded CodeQualitySettings defaults from migrate-code-quality.ts, with every
// rule enabled - analyzer tests exercise one rule at a time by writing source that only
// triggers that rule, not by narrowing enabledRuleCodes.
export function makeSettings(overrides: Partial<EffectiveScanSettings> = {}): EffectiveScanSettings {
  return {
    complexityLowMax: 5,
    complexityMediumMax: 10,
    complexityHighMax: 20,
    duplicationThresholdPercent: 5,
    minDuplicateBlockSize: 6,
    maxLineLength: 120,
    excludedDirectories: ["node_modules", ".next", ".git", "dist", "build"],
    allowedExtensions: [".ts", ".tsx", ".js", ".jsx"],
    maxScanSizeMb: 200,
    weights: { complexity: 25, duplication: 20, deadCode: 15, unusedVariables: 10, unusedFunctions: 10, codingStandards: 20 },
    scales: { complexity: 10, duplication: 2, deadCode: 8, unusedVariables: 6, unusedFunctions: 6, codingStandards: 5 },
    enabledRuleCodes: new Set([
      "complexity.function-threshold",
      "duplication.block",
      "deadcode.unreachable",
      "unused.variable",
      "unused.function",
      "style.max-line-length",
      "style.no-var",
      "style.no-console",
      "style.empty-block",
      "style.prefer-const",
      "style.naming-convention",
    ]),
    ...overrides,
  };
}
