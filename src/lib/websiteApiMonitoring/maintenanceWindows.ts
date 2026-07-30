import { getDb, sql } from "../db";

export interface MaintenanceWindowSchedule {
  startsAt: Date;
  endsAt: Date;
  isRecurring: boolean;
  recurrenceRule: "Daily" | "Weekly" | "Monthly" | null;
  isActive: boolean;
}

// Pure, unit-testable: is this window "on" right now? A one-off window is a plain date range.
// A recurring window's StartsAt/EndsAt instead describe a single occurrence's TIME-OF-DAY and
// DURATION, repeated every day/matching-weekday/matching-day-of-month from then on - all
// compared in UTC (StartsAt/EndsAt are stored as UTC DATETIME2), so this is deterministic
// regardless of the server's local timezone. Handles a window whose time-of-day range wraps
// past midnight (e.g. a nightly 23:00-01:00 maintenance window).
export function isMaintenanceWindowActiveNow(win: MaintenanceWindowSchedule, now: Date): boolean {
  if (!win.isActive) return false;
  if (now.getTime() < win.startsAt.getTime()) return false; // hasn't started yet, even for a recurring window's first occurrence

  if (!win.isRecurring) {
    return now.getTime() <= win.endsAt.getTime();
  }

  const durationMs = win.endsAt.getTime() - win.startsAt.getTime();
  if (durationMs <= 0) return false;

  if (win.recurrenceRule === "Weekly" && now.getUTCDay() !== win.startsAt.getUTCDay()) return false;
  if (win.recurrenceRule === "Monthly" && now.getUTCDate() !== win.startsAt.getUTCDate()) return false;

  const startOfUtcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const startTimeOfDayMs = win.startsAt.getTime() - startOfUtcDay(win.startsAt);
  const nowTimeOfDayMs = now.getTime() - startOfUtcDay(now);

  let elapsedSinceStartToday = nowTimeOfDayMs - startTimeOfDayMs;
  if (elapsedSinceStartToday < 0) elapsedSinceStartToday += 24 * 60 * 60 * 1000; // window start is late in the day and wraps past midnight

  return elapsedSinceStartToday < durationMs;
}

// Every monitor currently covered by an active maintenance window - the scan script skips
// checking these entirely and keeps/sets their Status as 'Maintenance', and sendMonitoringAlert
// is never even reached for them (no alert to suppress if the check never runs).
export async function getActiveMaintenanceMonitorIds(): Promise<Set<number>> {
  const db = await getDb();
  // Deliberately NOT going through CONVERT(VARCHAR, ..., 126) here (this app's usual
  // convention for handing dates to the frontend) - that produces a string with no timezone
  // marker, and re-parsing it with `new Date()` interprets it in the SERVER's local timezone
  // instead of UTC. Confirmed as a real bug on this deployment specifically: the server runs
  // Nepal Standard Time (UTC+5:45), so a stored UTC timestamp silently shifted by 5:45 and
  // made every window compare as inactive. mssql already returns DATETIME2 columns as native
  // JS Date objects (correct regardless of local TZ, since Date stores an absolute instant) -
  // selecting the raw columns and using them directly avoids the round-trip entirely.
  const result = await db.query<{
    MonitorId: number;
    StartsAt: Date;
    EndsAt: Date;
    IsRecurring: boolean;
    RecurrenceRule: "Daily" | "Weekly" | "Monthly" | null;
    IsActive: boolean;
  }>(`
    SELECT wm.MonitorId, w.StartsAt, w.EndsAt, w.IsRecurring, w.RecurrenceRule, w.IsActive
    FROM MaintenanceWindows w
    JOIN MaintenanceWindowMonitors wm ON wm.MaintenanceWindowId = w.Id
    WHERE w.IsActive = 1
  `);

  const now = new Date();
  const active = new Set<number>();
  for (const row of result.recordset) {
    const schedule: MaintenanceWindowSchedule = {
      startsAt: new Date(row.StartsAt),
      endsAt: new Date(row.EndsAt),
      isRecurring: row.IsRecurring,
      recurrenceRule: row.RecurrenceRule,
      isActive: row.IsActive,
    };
    if (isMaintenanceWindowActiveNow(schedule, now)) active.add(row.MonitorId);
  }
  return active;
}

// Flips every currently-in-window monitor to Status='Maintenance' (a value the original CHECK
// constraint already allowed), and flips any monitor that just LEFT its window (was
// 'Maintenance', not currently active anymore) back to 'Pending' so the next real check decides
// its actual status fresh rather than leaving it stuck showing 'Maintenance' forever.
export async function syncMaintenanceStatuses(activeMonitorIds: Set<number>): Promise<void> {
  const db = await getDb();
  if (activeMonitorIds.size > 0) {
    const ids = [...activeMonitorIds].join(",");
    await db.query(`UPDATE Monitors SET Status = 'Maintenance' WHERE Id IN (${ids}) AND Status <> 'Maintenance'`);
  }
  // `Id NOT IN (NULL)` is SQL's classic trap: it evaluates to UNKNOWN for every row (not TRUE),
  // so the UPDATE below would silently match nothing at all once activeMonitorIds ever became
  // empty - confirmed as a real bug by direct verification (a monitor never left 'Maintenance'
  // after its window ended). The empty-set case gets its own unconditional query instead of an
  // "IN (NULL)" placeholder.
  if (activeMonitorIds.size > 0) {
    const ids = [...activeMonitorIds].join(",");
    await db.query(`UPDATE Monitors SET Status = 'Pending', NextCheckAt = SYSUTCDATETIME() WHERE Status = 'Maintenance' AND Id NOT IN (${ids})`);
  } else {
    await db.query(`UPDATE Monitors SET Status = 'Pending', NextCheckAt = SYSUTCDATETIME() WHERE Status = 'Maintenance'`);
  }
}
