import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, _resetRateLimitForTests } from "./rateLimiter";

beforeEach(() => {
  _resetRateLimitForTests();
});

describe("checkRateLimit", () => {
  it("allows requests up to the limit within the window", () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(1, now + i)).toBe(true);
    }
  });

  it("denies the 6th request within the same 60s window", () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) checkRateLimit(1, now + i);
    expect(checkRateLimit(1, now + 5)).toBe(false);
  });

  it("tracks each user independently", () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) checkRateLimit(1, now + i);
    expect(checkRateLimit(2, now)).toBe(true);
  });

  it("allows requests again once the window has slid past", () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) checkRateLimit(1, now + i);
    expect(checkRateLimit(1, now + 61_000)).toBe(true);
  });
});
