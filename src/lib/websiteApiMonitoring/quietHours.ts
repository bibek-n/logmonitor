// Pure time-window logic for AlertPolicies' quiet hours - no DB/IO, fully unit-testable.
// Handles the overnight-wrap case (e.g. 22:00 -> 07:00) where start > end.
export function isWithinQuietHours(now: Date, startHHMM: string, endHHMM: string, timezone: string): boolean {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(now);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const current = `${hour}:${minute}`;

  if (startHHMM <= endHHMM) {
    return current >= startHHMM && current < endHHMM;
  }
  // Overnight window - "within" means at or after start, OR before end (wrapping past midnight).
  return current >= startHHMM || current < endHHMM;
}
