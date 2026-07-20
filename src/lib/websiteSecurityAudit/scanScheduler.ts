// Evaluates whether a website's custom scan schedule is "due" right now. The checker
// script that calls this runs frequently (every ~15 minutes, see run-website-security-
// daily-scan.ts) rather than once a day, so this needs its own tolerance/dedupe logic
// rather than relying on the checker's own cadence to avoid double-firing.
const CHECK_TOLERANCE_MINUTES = 10; // must be >= half the checker's polling interval
const MIN_GAP_BETWEEN_RUNS_MINUTES = 30; // shortest realistic gap between two distinct scanTimes entries

export type ScheduleType = "Daily" | "Weekly" | "Monthly" | "Yearly";

export interface ScanSchedule {
  scheduleType: ScheduleType;
  timesPerDay: number;
  scanTimes: string[]; // "HH:MM" 24-hour, length should match timesPerDay
  repeatIntervalDays: number | null;
  dayOfWeek: number | null; // 0=Sunday..6=Saturday (Weekly)
  dayOfMonth: number | null; // 1-31 (Monthly/Yearly)
  monthOfYear: number | null; // 1-12 (Yearly)
  lastRunAt: Date | null;
}

function timeMatches(now: Date, hhmm: string): boolean {
  const parts = hhmm.split(":").map(Number);
  if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) return false;
  const target = new Date(now);
  target.setHours(parts[0], parts[1], 0, 0);
  const diffMinutes = Math.abs(now.getTime() - target.getTime()) / 60000;
  return diffMinutes <= CHECK_TOLERANCE_MINUTES;
}

function isCorrectCalendarDay(now: Date, schedule: ScanSchedule): boolean {
  switch (schedule.scheduleType) {
    case "Daily":
      return true;
    case "Weekly":
      return schedule.dayOfWeek === now.getDay();
    case "Monthly":
      return schedule.dayOfMonth === now.getDate();
    case "Yearly":
      return schedule.dayOfMonth === now.getDate() && schedule.monthOfYear === now.getMonth() + 1;
    default:
      return false;
  }
}

// A repeat-interval (every N days) is an independent override of the ScheduleType-based
// calendar cadence — when set, it replaces the Daily/Weekly/Monthly/Yearly day check
// entirely, but the configured scanTimes/timesPerDay still apply on whichever day it lands.
export function isScheduleDue(schedule: ScanSchedule, now: Date = new Date()): boolean {
  if (schedule.repeatIntervalDays && schedule.repeatIntervalDays > 0) {
    const daysSinceLastRun = schedule.lastRunAt ? (now.getTime() - schedule.lastRunAt.getTime()) / 86400000 : Infinity;
    if (daysSinceLastRun < schedule.repeatIntervalDays) return false;
  } else if (!isCorrectCalendarDay(now, schedule)) {
    return false;
  }

  const matchesATime = schedule.scanTimes.some((t) => timeMatches(now, t));
  if (!matchesATime) return false;

  if (schedule.lastRunAt) {
    const minutesSinceLastRun = (now.getTime() - schedule.lastRunAt.getTime()) / 60000;
    if (minutesSinceLastRun < MIN_GAP_BETWEEN_RUNS_MINUTES) return false;
  }

  return true;
}

export function parseScanTimes(csv: string): string[] {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
