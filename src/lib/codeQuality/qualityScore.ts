import type { EffectiveScanSettings, IssueSeverity } from "./types";

export interface QualityScoreInputs {
  linesOfCode: number;
  complexityPenaltySum: number; // Σ max(0, complexity(f) - complexityLowMax) over every function
  functionCount: number;
  duplicatedLines: number;
  totalSignificantLines: number;
  deadCodeCount: number;
  unusedVariableCount: number;
  unusedFunctionCount: number;
  codingStandardsViolationSeverities: IssueSeverity[];
}

export interface QualityScoreBreakdown {
  overall: number; // 0-100, clamped
  categories: {
    complexity: number;
    duplication: number;
    deadCode: number;
    unusedVariables: number;
    unusedFunctions: number;
    codingStandards: number;
  };
}

const SEVERITY_WEIGHT: Record<IssueSeverity, number> = { Low: 1, Medium: 2, High: 4, Critical: 8 };

// Documented formula (see the module's own architecture notes / README):
//
//   Score = clamp(0, 100, Σ CategoryScore_i × Weight_i)
//
//   Complexity   = 100 − min(100, avgPenaltyPerFunction × scaleComplexity)
//                  avgPenaltyPerFunction = Σ max(0, complexity(f) − lowMax) ÷ functionCount
//   Duplication  = 100 − min(100, duplicationPercent × scaleDuplication)
//   DeadCode     = 100 − min(100, (deadCodeCount ÷ KLOC) × scaleDeadCode)
//   UnusedVars   = 100 − min(100, (unusedVarCount ÷ KLOC) × scaleUnusedVariables)
//   UnusedFuncs  = 100 − min(100, (unusedFuncCount ÷ KLOC) × scaleUnusedFunctions)
//   CodingStds   = 100 − min(100, (Σ severityWeight(v) ÷ KLOC) × scaleCodingStandards)
//                  severityWeight: Low=1, Medium=2, High=4, Critical=8
//
// KLOC = max(1, linesOfCode / 1000) - the floor at 1 stops tiny projects (a handful of lines)
// from producing wildly inflated per-KLOC densities. Every weight/scale factor is read from
// CodeQualitySettings (via EffectiveScanSettings), never hard-coded, so an administrator can
// retune the formula without a code change.
export function calculateQualityScore(inputs: QualityScoreInputs, settings: EffectiveScanSettings): QualityScoreBreakdown {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const kloc = Math.max(1, inputs.linesOfCode / 1000);

  const avgComplexityPenalty = inputs.functionCount > 0 ? inputs.complexityPenaltySum / inputs.functionCount : 0;
  const complexity = clamp(100 - Math.min(100, avgComplexityPenalty * settings.scales.complexity));

  const duplicationPercent = inputs.totalSignificantLines > 0 ? (inputs.duplicatedLines / inputs.totalSignificantLines) * 100 : 0;
  const duplication = clamp(100 - Math.min(100, duplicationPercent * settings.scales.duplication));

  const deadCode = clamp(100 - Math.min(100, (inputs.deadCodeCount / kloc) * settings.scales.deadCode));
  const unusedVariables = clamp(100 - Math.min(100, (inputs.unusedVariableCount / kloc) * settings.scales.unusedVariables));
  const unusedFunctions = clamp(100 - Math.min(100, (inputs.unusedFunctionCount / kloc) * settings.scales.unusedFunctions));

  const codingStandardsPenalty = inputs.codingStandardsViolationSeverities.reduce((sum, s) => sum + SEVERITY_WEIGHT[s], 0);
  const codingStandards = clamp(100 - Math.min(100, (codingStandardsPenalty / kloc) * settings.scales.codingStandards));

  const w = settings.weights;
  const totalWeight = w.complexity + w.duplication + w.deadCode + w.unusedVariables + w.unusedFunctions + w.codingStandards;
  const safeTotalWeight = totalWeight > 0 ? totalWeight : 1;

  const overall = clamp(
    (complexity * w.complexity +
      duplication * w.duplication +
      deadCode * w.deadCode +
      unusedVariables * w.unusedVariables +
      unusedFunctions * w.unusedFunctions +
      codingStandards * w.codingStandards) /
      safeTotalWeight
  );

  return {
    overall: Math.round(overall),
    categories: {
      complexity: Math.round(complexity),
      duplication: Math.round(duplication),
      deadCode: Math.round(deadCode),
      unusedVariables: Math.round(unusedVariables),
      unusedFunctions: Math.round(unusedFunctions),
      codingStandards: Math.round(codingStandards),
    },
  };
}
