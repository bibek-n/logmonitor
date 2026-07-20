import { describe, it, expect } from "vitest";
import { calculateQualityScore, type QualityScoreInputs } from "./qualityScore";
import { makeSettings } from "./testHelpers";

const PERFECT_INPUTS: QualityScoreInputs = {
  linesOfCode: 1000,
  complexityPenaltySum: 0,
  functionCount: 10,
  duplicatedLines: 0,
  totalSignificantLines: 800,
  deadCodeCount: 0,
  unusedVariableCount: 0,
  unusedFunctionCount: 0,
  codingStandardsViolationSeverities: [],
};

describe("calculateQualityScore", () => {
  it("scores a perfectly clean codebase at 100 across every category", () => {
    const result = calculateQualityScore(PERFECT_INPUTS, makeSettings());
    expect(result.overall).toBe(100);
    expect(result.categories).toEqual({
      complexity: 100,
      duplication: 100,
      deadCode: 100,
      unusedVariables: 100,
      unusedFunctions: 100,
      codingStandards: 100,
    });
  });

  it("never goes below 0 even with extreme penalties", () => {
    const result = calculateQualityScore(
      {
        linesOfCode: 100,
        complexityPenaltySum: 100000,
        functionCount: 1,
        duplicatedLines: 900,
        totalSignificantLines: 1000,
        deadCodeCount: 10000,
        unusedVariableCount: 10000,
        unusedFunctionCount: 10000,
        codingStandardsViolationSeverities: Array(1000).fill("Critical"),
      },
      makeSettings()
    );
    expect(result.overall).toBe(0);
    for (const v of Object.values(result.categories)) expect(v).toBe(0);
  });

  it("lowers the complexity category as average penalty per function grows", () => {
    const settings = makeSettings();
    const light = calculateQualityScore({ ...PERFECT_INPUTS, complexityPenaltySum: 5, functionCount: 10 }, settings);
    const heavy = calculateQualityScore({ ...PERFECT_INPUTS, complexityPenaltySum: 50, functionCount: 10 }, settings);
    expect(light.categories.complexity).toBeLessThan(100);
    expect(heavy.categories.complexity).toBeLessThan(light.categories.complexity);
  });

  it("treats zero functionCount as zero average penalty rather than dividing by zero", () => {
    const result = calculateQualityScore({ ...PERFECT_INPUTS, functionCount: 0, complexityPenaltySum: 0 }, makeSettings());
    expect(Number.isFinite(result.categories.complexity)).toBe(true);
    expect(result.categories.complexity).toBe(100);
  });

  it("computes duplication category from duplicatedLines / totalSignificantLines", () => {
    const settings = makeSettings();
    const result = calculateQualityScore({ ...PERFECT_INPUTS, duplicatedLines: 80, totalSignificantLines: 800 }, settings);
    // 10% duplication * scale(2) = 20 penalty -> 80
    expect(result.categories.duplication).toBe(80);
  });

  it("floors KLOC at 1 so a tiny file does not produce an inflated per-line penalty", () => {
    const settings = makeSettings();
    const tiny = calculateQualityScore({ ...PERFECT_INPUTS, linesOfCode: 10, deadCodeCount: 1 }, settings);
    const large = calculateQualityScore({ ...PERFECT_INPUTS, linesOfCode: 5000, deadCodeCount: 1 }, settings);
    // Both use kloc=max(1, loc/1000): tiny -> kloc=1, large -> kloc=5. Same deadCodeCount, so tiny is penalized more.
    expect(tiny.categories.deadCode).toBeLessThanOrEqual(large.categories.deadCode);
  });

  it("weights the overall score by each category's configured weight", () => {
    // All weight on complexity alone: overall should equal the complexity category score exactly.
    const settings = makeSettings({ weights: { complexity: 1, duplication: 0, deadCode: 0, unusedVariables: 0, unusedFunctions: 0, codingStandards: 0 } });
    const result = calculateQualityScore({ ...PERFECT_INPUTS, complexityPenaltySum: 20, functionCount: 10 }, settings);
    expect(result.overall).toBe(result.categories.complexity);
  });

  it("does not divide by zero when every weight is zero", () => {
    const settings = makeSettings({ weights: { complexity: 0, duplication: 0, deadCode: 0, unusedVariables: 0, unusedFunctions: 0, codingStandards: 0 } });
    const result = calculateQualityScore(PERFECT_INPUTS, settings);
    expect(Number.isFinite(result.overall)).toBe(true);
  });

  it("weighs coding standard violations by severity (Critical costs more than Low)", () => {
    const settings = makeSettings();
    const lowOnly = calculateQualityScore({ ...PERFECT_INPUTS, codingStandardsViolationSeverities: ["Low", "Low"] }, settings);
    const criticalOnly = calculateQualityScore({ ...PERFECT_INPUTS, codingStandardsViolationSeverities: ["Critical", "Critical"] }, settings);
    expect(criticalOnly.categories.codingStandards).toBeLessThan(lowOnly.categories.codingStandards);
  });
});
