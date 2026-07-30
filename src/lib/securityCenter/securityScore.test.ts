import { describe, it, expect } from "vitest";
import { computeSecurityScore, deductionFor, riskLevelForScore } from "./securityScore";

describe("deductionFor", () => {
  it("deducts nothing for an empty counts object", () => {
    expect(deductionFor({})).toBe(0);
  });

  it("weights critical > high > medium > low, and zero for informational", () => {
    expect(deductionFor({ Critical: 1 })).toBe(20);
    expect(deductionFor({ High: 1 })).toBe(12);
    expect(deductionFor({ Medium: 1 })).toBe(6);
    expect(deductionFor({ Low: 1 })).toBe(2);
    expect(deductionFor({ Informational: 1 })).toBe(0);
  });

  it("multiplies deduction by count and is case-insensitive to severity casing", () => {
    expect(deductionFor({ Critical: 3 })).toBe(60);
    expect(deductionFor({ critical: 2 })).toBe(40); // IDS's SecurityAlerts use lowercase severities
  });

  it("sums across multiple severities", () => {
    expect(deductionFor({ Critical: 1, High: 2, Low: 5 })).toBe(20 + 24 + 10);
  });

  it("ignores an unrecognized severity key rather than throwing", () => {
    expect(deductionFor({ NotARealSeverity: 5 })).toBe(0);
  });
});

describe("computeSecurityScore", () => {
  it("returns 100 across the board when every component has zero open findings", () => {
    const { overallScore, componentScores } = computeSecurityScore({ vulnerabilities: {}, malware: {}, intrusionAlerts: {} });
    expect(overallScore).toBe(100);
    expect(componentScores).toEqual({ vulnerabilities: 100, malware: 100, intrusionAlerts: 100 });
  });

  it("floors each component score at 0 rather than going negative", () => {
    const { componentScores } = computeSecurityScore({ vulnerabilities: { Critical: 10 }, malware: {}, intrusionAlerts: {} });
    expect(componentScores.vulnerabilities).toBe(0);
  });

  it("averages the three component scores for the overall figure", () => {
    // vulnerabilities: 100 - 20 = 80, malware: 100, intrusionAlerts: 100 -> mean = 93.33 -> rounds to 93
    const { overallScore } = computeSecurityScore({ vulnerabilities: { Critical: 1 }, malware: {}, intrusionAlerts: {} });
    expect(overallScore).toBe(93);
  });

  it("clamps the overall score within [0, 100]", () => {
    const { overallScore } = computeSecurityScore({
      vulnerabilities: { Critical: 20 },
      malware: { Critical: 20 },
      intrusionAlerts: { Critical: 20 },
    });
    expect(overallScore).toBeGreaterThanOrEqual(0);
    expect(overallScore).toBeLessThanOrEqual(100);
    expect(overallScore).toBe(0);
  });
});

describe("riskLevelForScore", () => {
  it("buckets scores into Critical/High/Medium/Low at the documented thresholds", () => {
    expect(riskLevelForScore(0)).toBe("Critical");
    expect(riskLevelForScore(39)).toBe("Critical");
    expect(riskLevelForScore(40)).toBe("High");
    expect(riskLevelForScore(59)).toBe("High");
    expect(riskLevelForScore(60)).toBe("Medium");
    expect(riskLevelForScore(79)).toBe("Medium");
    expect(riskLevelForScore(80)).toBe("Low");
    expect(riskLevelForScore(100)).toBe("Low");
  });
});
