import { describe, it, expect } from "vitest";
import { riskLevelForScore } from "./securityScore";

// computeWeightedSecurityScore() itself is DB-backed (five live queries against
// DeviceUpdateScans/SecurityAlerts/DeviceSecurityStatus/Users/BackupHistory) and isn't unit
// tested here - see src/lib/securityCenter/securityScore.ts's own comment for the formula and
// why it replaced the old deduct-from-100 heuristic this file used to test (that heuristic
// summed an uncapped per-finding deduction across three unrelated tables, so any real standing
// alert backlog floored every component to 0 - as few as 5 open criticals in any one table).
// riskLevelForScore is the one piece of pure, DB-free logic worth a unit test.

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
