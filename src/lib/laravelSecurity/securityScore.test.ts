import { describe, it, expect } from "vitest";
import { calculateSecurityScore } from "./securityScore";
import { makeSettings } from "./testHelpers";
import type { AnalyzerIssue } from "./types";

function issue(category: AnalyzerIssue["category"], severity: AnalyzerIssue["severity"]): AnalyzerIssue {
  return {
    category,
    ruleCode: "test.rule",
    title: "t",
    description: "d",
    filePath: "f.php",
    startLine: 1,
    endLine: 1,
    severity,
  };
}

describe("calculateSecurityScore", () => {
  it("scores 100 with no issues", () => {
    const { overall, categories } = calculateSecurityScore([], makeSettings());
    expect(overall).toBe(100);
    expect(categories.AppDebug).toBe(100);
  });

  it("deducts points-per-severity from only the affected category", () => {
    const { categories } = calculateSecurityScore([issue("AppDebug", "Critical")], makeSettings());
    expect(categories.AppDebug).toBe(80); // 100 - pointsPerSeverity.critical (20)
    expect(categories.AppKey).toBe(100); // untouched
  });

  it("clamps a category's score at 0, never negative", () => {
    const issues = Array.from({ length: 10 }, () => issue("Csrf", "Critical")); // 10 * 20 = 200 points
    const { categories } = calculateSecurityScore(issues, makeSettings());
    expect(categories.Csrf).toBe(0);
  });

  it("weights the overall score by each category's configured weight", () => {
    // Tank one 15-weight category (AppDebug) completely; every other category stays at 100.
    const issues = Array.from({ length: 5 }, () => issue("AppDebug", "Critical")); // >= 100 points
    const settings = makeSettings();
    const { overall, categories } = calculateSecurityScore(issues, settings);
    expect(categories.AppDebug).toBe(0);
    // overall = (0*15 + 100*(sum of the other 8 weights)) / 100 = (100-15) = 85
    expect(overall).toBe(85);
  });
});
