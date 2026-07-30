import { describe, it, expect } from "vitest";
import { isMaintenanceWindowActiveNow, MaintenanceWindowSchedule } from "./maintenanceWindows";

function schedule(overrides: Partial<MaintenanceWindowSchedule>): MaintenanceWindowSchedule {
  return {
    startsAt: new Date("2026-01-05T10:00:00Z"), // a Monday
    endsAt: new Date("2026-01-05T12:00:00Z"),
    isRecurring: false,
    recurrenceRule: null,
    isActive: true,
    ...overrides,
  };
}

describe("isMaintenanceWindowActiveNow - one-off windows", () => {
  it("is active within the date range", () => {
    expect(isMaintenanceWindowActiveNow(schedule({}), new Date("2026-01-05T11:00:00Z"))).toBe(true);
  });

  it("is not active before the window starts", () => {
    expect(isMaintenanceWindowActiveNow(schedule({}), new Date("2026-01-05T09:00:00Z"))).toBe(false);
  });

  it("is not active after the window ends", () => {
    expect(isMaintenanceWindowActiveNow(schedule({}), new Date("2026-01-05T13:00:00Z"))).toBe(false);
  });

  it("is never active when IsActive is false", () => {
    expect(isMaintenanceWindowActiveNow(schedule({ isActive: false }), new Date("2026-01-05T11:00:00Z"))).toBe(false);
  });
});

describe("isMaintenanceWindowActiveNow - daily recurrence", () => {
  it("is active at the same time-of-day on a later date", () => {
    const win = schedule({ isRecurring: true, recurrenceRule: "Daily" });
    expect(isMaintenanceWindowActiveNow(win, new Date("2026-02-10T11:00:00Z"))).toBe(true);
  });

  it("is not active outside the time-of-day window on a later date", () => {
    const win = schedule({ isRecurring: true, recurrenceRule: "Daily" });
    expect(isMaintenanceWindowActiveNow(win, new Date("2026-02-10T13:00:00Z"))).toBe(false);
  });

  it("is not active before the first occurrence's start date", () => {
    const win = schedule({ isRecurring: true, recurrenceRule: "Daily" });
    expect(isMaintenanceWindowActiveNow(win, new Date("2026-01-01T11:00:00Z"))).toBe(false);
  });

  it("handles an overnight recurring window wrapping past midnight", () => {
    const win = schedule({ startsAt: new Date("2026-01-05T23:00:00Z"), endsAt: new Date("2026-01-06T01:00:00Z"), isRecurring: true, recurrenceRule: "Daily" });
    expect(isMaintenanceWindowActiveNow(win, new Date("2026-02-10T23:30:00Z"))).toBe(true);
    expect(isMaintenanceWindowActiveNow(win, new Date("2026-02-11T00:30:00Z"))).toBe(true);
    expect(isMaintenanceWindowActiveNow(win, new Date("2026-02-10T12:00:00Z"))).toBe(false);
  });
});

describe("isMaintenanceWindowActiveNow - weekly recurrence", () => {
  it("is active on a later date with the same weekday", () => {
    // 2026-01-05 is a Monday; 2026-01-19 is also a Monday
    const win = schedule({ isRecurring: true, recurrenceRule: "Weekly" });
    expect(isMaintenanceWindowActiveNow(win, new Date("2026-01-19T11:00:00Z"))).toBe(true);
  });

  it("is not active on a later date with a different weekday", () => {
    // 2026-01-06 is a Tuesday
    const win = schedule({ isRecurring: true, recurrenceRule: "Weekly" });
    expect(isMaintenanceWindowActiveNow(win, new Date("2026-01-06T11:00:00Z"))).toBe(false);
  });
});

describe("isMaintenanceWindowActiveNow - monthly recurrence", () => {
  it("is active on a later month with the same day-of-month", () => {
    const win = schedule({ isRecurring: true, recurrenceRule: "Monthly" });
    expect(isMaintenanceWindowActiveNow(win, new Date("2026-03-05T11:00:00Z"))).toBe(true);
  });

  it("is not active on a different day-of-month", () => {
    const win = schedule({ isRecurring: true, recurrenceRule: "Monthly" });
    expect(isMaintenanceWindowActiveNow(win, new Date("2026-03-06T11:00:00Z"))).toBe(false);
  });
});
