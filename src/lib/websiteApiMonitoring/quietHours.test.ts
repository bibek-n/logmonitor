import { describe, it, expect } from "vitest";
import { isWithinQuietHours } from "./quietHours";

describe("isWithinQuietHours", () => {
  it("returns true for a same-day window that contains the current time", () => {
    // 2026-01-01T15:30:00Z is 15:30 UTC
    const now = new Date("2026-01-01T15:30:00Z");
    expect(isWithinQuietHours(now, "09:00", "17:00", "UTC")).toBe(true);
  });

  it("returns false for a same-day window that doesn't contain the current time", () => {
    const now = new Date("2026-01-01T20:00:00Z");
    expect(isWithinQuietHours(now, "09:00", "17:00", "UTC")).toBe(false);
  });

  it("handles an overnight window that wraps past midnight - inside the late part", () => {
    const now = new Date("2026-01-01T23:30:00Z"); // 23:30 UTC
    expect(isWithinQuietHours(now, "22:00", "07:00", "UTC")).toBe(true);
  });

  it("handles an overnight window that wraps past midnight - inside the early part", () => {
    const now = new Date("2026-01-01T03:00:00Z"); // 03:00 UTC
    expect(isWithinQuietHours(now, "22:00", "07:00", "UTC")).toBe(true);
  });

  it("handles an overnight window that wraps past midnight - outside the window", () => {
    const now = new Date("2026-01-01T12:00:00Z"); // noon UTC
    expect(isWithinQuietHours(now, "22:00", "07:00", "UTC")).toBe(false);
  });

  it("respects a non-UTC timezone", () => {
    // 2026-01-01T18:30:00Z is 00:30 in Asia/Kathmandu (UTC+5:45)
    const now = new Date("2026-01-01T18:30:00Z");
    expect(isWithinQuietHours(now, "22:00", "07:00", "Asia/Kathmandu")).toBe(true);
    expect(isWithinQuietHours(now, "09:00", "17:00", "Asia/Kathmandu")).toBe(false);
  });

  it("treats the start boundary as inclusive and the end boundary as exclusive", () => {
    expect(isWithinQuietHours(new Date("2026-01-01T09:00:00Z"), "09:00", "17:00", "UTC")).toBe(true);
    expect(isWithinQuietHours(new Date("2026-01-01T17:00:00Z"), "09:00", "17:00", "UTC")).toBe(false);
  });
});
