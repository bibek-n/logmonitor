export const SSL_ALERT_THRESHOLDS_DAYS = [60, 30, 14, 7, 3, 1, 0];

export interface SslAlertDecision {
  shouldAlert: boolean;
  crossedThresholdDays: number | null;
  isExpired: boolean;
}

// Deduplicates SSL expiry alerts based on which threshold was last alerted (spec section 16:
// "do not create a new SSL incident during every monitoring check... deduplicate SSL alerts
// based on certificate, monitor, and threshold"). A cert with 45 days remaining only alerts
// once it crosses below 60; it does NOT alert again on every subsequent daily check while
// sitting between 30 and 60 - only when it crosses the NEXT threshold down (30, then 14, ...).
// `lastAlertedThresholdDays` is null until the first alert ever fires for this monitor.
export function evaluateSslExpiry(daysRemaining: number, lastAlertedThresholdDays: number | null): SslAlertDecision {
  const isExpired = daysRemaining < 0;
  const effectiveDays = isExpired ? 0 : daysRemaining;

  // The most urgent threshold currently applicable is the SMALLEST T with T >= effectiveDays
  // (e.g. 28 days remaining qualifies for the 30-day checkpoint, not 60 - 60 was already
  // crossed, and passed, days ago). Searching the ascending order finds that smallest
  // qualifying T first; SSL_ALERT_THRESHOLDS_DAYS itself stays descending for display order.
  const ascending = [...SSL_ALERT_THRESHOLDS_DAYS].sort((a, b) => a - b);
  const crossedThreshold = ascending.find((t) => effectiveDays <= t);
  if (crossedThreshold === undefined) {
    return { shouldAlert: false, crossedThresholdDays: null, isExpired };
  }

  const alreadyAlertedThisOrMoreUrgent = lastAlertedThresholdDays !== null && lastAlertedThresholdDays <= crossedThreshold;
  if (alreadyAlertedThisOrMoreUrgent) {
    return { shouldAlert: false, crossedThresholdDays: crossedThreshold, isExpired };
  }

  return { shouldAlert: true, crossedThresholdDays: crossedThreshold, isExpired };
}
