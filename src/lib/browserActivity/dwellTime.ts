// Dwell-time estimation from consecutive same-domain visit timestamps. This is an estimate,
// not a real measurement (browsers don't record "time on page") — labeled "Est. time on
// domain" wherever shown in the UI. Kept here (rather than only in the agent) so the same
// logic is unit-testable and reusable if dwell computation is ever moved server-side.
const DEFAULT_CAP_SECONDS = 1800; // 30 minutes — bounds an overnight-open tab from inflating totals

export interface TimestampedVisit {
  visitedAt: Date;
}

// Returns dwellSeconds for each input visit, same order as input (not the sorted order used
// internally). The last visit in a domain's chronological sequence gets null — there's no
// next timestamp to bound it, so no estimate is claimed rather than guessing one.
export function computeDwellSeconds<T extends TimestampedVisit>(visits: T[], capSeconds: number = DEFAULT_CAP_SECONDS): (number | null)[] {
  if (visits.length === 0) return [];
  if (visits.length === 1) return [null];

  const indexed = visits.map((visit, index) => ({ visit, index }));
  const sorted = [...indexed].sort((a, b) => a.visit.visitedAt.getTime() - b.visit.visitedAt.getTime());

  const dwellByIndex = new Array<number | null>(visits.length).fill(null);
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const deltaSeconds = Math.round((next.visit.visitedAt.getTime() - current.visit.visitedAt.getTime()) / 1000);
    dwellByIndex[current.index] = Math.min(Math.max(deltaSeconds, 0), capSeconds);
  }
  // The last (most recent) visit in the sorted sequence has no next timestamp — stays null.
  dwellByIndex[sorted[sorted.length - 1].index] = null;

  return dwellByIndex;
}
