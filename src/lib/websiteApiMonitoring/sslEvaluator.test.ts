import { describe, it, expect } from "vitest";
import { evaluateSslExpiry } from "./sslEvaluator";

describe("evaluateSslExpiry", () => {
  it("alerts on first check when already within the 60-day threshold", () => {
    const result = evaluateSslExpiry(45, null);
    expect(result.shouldAlert).toBe(true);
    expect(result.crossedThresholdDays).toBe(60);
  });

  it("does not re-alert for the same threshold on a later check", () => {
    const result = evaluateSslExpiry(40, 60);
    expect(result.shouldAlert).toBe(false);
    expect(result.crossedThresholdDays).toBe(60);
  });

  it("alerts again once crossing into the next, more urgent threshold", () => {
    const result = evaluateSslExpiry(25, 60);
    expect(result.shouldAlert).toBe(true);
    expect(result.crossedThresholdDays).toBe(30);
  });

  it("picks the smallest qualifying threshold, not the largest", () => {
    // 28 days remaining should map to 30, not to 60 - regression test for the bug where
    // the original descending-array .find() returned the first (largest) match.
    const result = evaluateSslExpiry(28, null);
    expect(result.crossedThresholdDays).toBe(30);
  });

  it("treats a negative days-remaining value as expired and clamps to the 0-day threshold", () => {
    const result = evaluateSslExpiry(-5, 1);
    expect(result.isExpired).toBe(true);
    expect(result.crossedThresholdDays).toBe(0);
    expect(result.shouldAlert).toBe(true);
  });

  it("does not alert when nothing above 60 days remains (no threshold crossed yet)", () => {
    const result = evaluateSslExpiry(90, null);
    expect(result.shouldAlert).toBe(false);
    expect(result.crossedThresholdDays).toBeNull();
  });

  it("re-alerts from scratch when the caller resets lastAlertedThresholdDays to null for a renewed certificate", () => {
    // Renewal detection itself lives outside this pure function (the scan script resets
    // LastAlertThresholdDays to null when it sees a new ExpiresAt) - here we only confirm
    // that a null reset behaves like a first-ever check, even if a prior cert had alerted deep.
    const result = evaluateSslExpiry(45, null);
    expect(result.shouldAlert).toBe(true);
    expect(result.crossedThresholdDays).toBe(60);
  });
});
