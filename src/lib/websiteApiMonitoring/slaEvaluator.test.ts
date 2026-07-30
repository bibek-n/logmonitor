import { describe, it, expect } from "vitest";
import { getSlaPeriodStart, evaluateSlaBreach } from "./slaEvaluator";

describe("getSlaPeriodStart", () => {
  it("returns the 1st of the month at 00:00 UTC for Monthly", () => {
    const now = new Date("2026-03-15T14:30:00Z");
    expect(getSlaPeriodStart("Monthly", now).toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("returns today at 00:00 UTC for Daily", () => {
    const now = new Date("2026-03-15T14:30:00Z");
    expect(getSlaPeriodStart("Daily", now).toISOString()).toBe("2026-03-15T00:00:00.000Z");
  });

  it("returns the most recent Monday for Weekly", () => {
    // 2026-03-18 is a Wednesday; the preceding Monday is 2026-03-16
    const now = new Date("2026-03-18T14:30:00Z");
    expect(getSlaPeriodStart("Weekly", now).toISOString()).toBe("2026-03-16T00:00:00.000Z");
  });

  it("handles a Sunday correctly for Weekly (belongs to the week that started the prior Monday)", () => {
    // 2026-03-22 is a Sunday; the preceding Monday is 2026-03-16
    const now = new Date("2026-03-22T23:00:00Z");
    expect(getSlaPeriodStart("Weekly", now).toISOString()).toBe("2026-03-16T00:00:00.000Z");
  });

  it("returns the date itself when now is already exactly on a Monday", () => {
    const now = new Date("2026-03-16T05:00:00Z");
    expect(getSlaPeriodStart("Weekly", now).toISOString()).toBe("2026-03-16T00:00:00.000Z");
  });
});

describe("evaluateSlaBreach", () => {
  const periodStart = new Date("2026-03-01T00:00:00Z");

  it("does not alert when actual meets or exceeds target", () => {
    expect(evaluateSlaBreach(99.95, 99.9, periodStart, null).shouldAlert).toBe(false);
    expect(evaluateSlaBreach(99.9, 99.9, periodStart, null).shouldAlert).toBe(false);
  });

  it("alerts on a fresh breach with no prior alert recorded", () => {
    expect(evaluateSlaBreach(98.5, 99.9, periodStart, null).shouldAlert).toBe(true);
  });

  it("does not re-alert for the same period once already alerted", () => {
    expect(evaluateSlaBreach(98.5, 99.9, periodStart, periodStart).shouldAlert).toBe(false);
  });

  it("alerts again once a new period has started, even if still breached", () => {
    const newPeriodStart = new Date("2026-04-01T00:00:00Z");
    const lastBreachedPreviousPeriod = periodStart;
    expect(evaluateSlaBreach(98.5, 99.9, newPeriodStart, lastBreachedPreviousPeriod).shouldAlert).toBe(true);
  });
});
