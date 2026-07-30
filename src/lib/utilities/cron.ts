// Hand-rolled standard 5-field cron parser (minute hour day-of-month month day-of-week).
// Supports *, lists (a,b,c), ranges (a-b), steps (*/n or a-b/n). No seconds field and no
// special strings like @daily - kept to the widely-used 5-field Unix cron syntax.

interface FieldRange {
  min: number;
  max: number;
}

const FIELD_RANGES: FieldRange[] = [
  { min: 0, max: 59 }, // minute
  { min: 0, max: 23 }, // hour
  { min: 1, max: 31 }, // day of month
  { min: 1, max: 12 }, // month
  { min: 0, max: 6 }, // day of week (0 = Sunday)
];

const FIELD_NAMES = ["minute", "hour", "day-of-month", "month", "day-of-week"];

function parseField(field: string, range: FieldRange): Set<number> {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const match = part.match(/^(\*|\d+-\d+|\d+)(?:\/(\d+))?$/);
    if (!match) throw new Error(`Invalid cron field segment: "${part}"`);
    const [, base, stepStr] = match;
    const step = stepStr ? Number(stepStr) : 1;
    if (step <= 0) throw new Error(`Invalid step in "${part}"`);

    let lo: number, hi: number;
    if (base === "*") {
      lo = range.min;
      hi = range.max;
    } else if (base.includes("-")) {
      const [a, b] = base.split("-").map(Number);
      lo = a;
      hi = b;
      if (lo > hi) throw new Error(`Invalid range "${base}"`);
    } else {
      lo = hi = Number(base);
    }
    if (lo < range.min || hi > range.max) {
      throw new Error(`Value out of range (${range.min}-${range.max}) in "${part}"`);
    }
    for (let v = lo; v <= hi; v += step) values.add(v);
  }
  return values;
}

export interface ParsedCron {
  minute: Set<number>;
  hour: Set<number>;
  dayOfMonth: Set<number>;
  month: Set<number>;
  dayOfWeek: Set<number>;
  dayOfMonthWildcard: boolean;
  dayOfWeekWildcard: boolean;
}

export function parseCronExpression(expr: string): ParsedCron {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`Expected 5 fields (${FIELD_NAMES.join(" ")}), got ${fields.length}`);
  }
  return {
    minute: parseField(fields[0], FIELD_RANGES[0]),
    hour: parseField(fields[1], FIELD_RANGES[1]),
    dayOfMonth: parseField(fields[2], FIELD_RANGES[2]),
    month: parseField(fields[3], FIELD_RANGES[3]),
    dayOfWeek: parseField(fields[4], FIELD_RANGES[4]),
    dayOfMonthWildcard: fields[2] === "*",
    dayOfWeekWildcard: fields[4] === "*",
  };
}

// Standard cron semantics: when BOTH day-of-month and day-of-week are restricted (neither is
// "*"), a date matches if it satisfies EITHER field (OR), not both (AND).
function matchesDate(cron: ParsedCron, d: Date): boolean {
  if (!cron.minute.has(d.getMinutes())) return false;
  if (!cron.hour.has(d.getHours())) return false;
  if (!cron.month.has(d.getMonth() + 1)) return false;

  const domMatch = cron.dayOfMonth.has(d.getDate());
  const dowMatch = cron.dayOfWeek.has(d.getDay());

  if (cron.dayOfMonthWildcard && cron.dayOfWeekWildcard) return true;
  if (cron.dayOfMonthWildcard) return dowMatch;
  if (cron.dayOfWeekWildcard) return domMatch;
  return domMatch || dowMatch;
}

// Bounded to ~2 years of minutes so an expression that can never match (e.g. day-of-month 31
// combined with a month that never has 31 days) fails fast instead of hanging the tab.
const MAX_ITERATIONS = 2 * 366 * 24 * 60;

export function nextRunTimes(expr: string, count: number, from: Date = new Date()): Date[] {
  const cron = parseCronExpression(expr);
  const results: Date[] = [];
  const cursor = new Date(from);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);

  let iterations = 0;
  while (results.length < count && iterations < MAX_ITERATIONS) {
    if (matchesDate(cron, cursor)) {
      results.push(new Date(cursor));
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
    iterations++;
  }
  if (results.length === 0) {
    throw new Error("No matching run time found in the next 2 years - check the expression");
  }
  return results;
}
