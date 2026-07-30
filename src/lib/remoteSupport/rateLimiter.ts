// No generic per-user rate limiter exists anywhere else in this codebase (confirmed - only
// third-party API rate limits are referenced elsewhere), so this is purpose-built for Remote
// Support's session-request endpoint. An in-memory sliding window is deliberately simple: this
// app runs as a single IIS/iisnode worker process, not a multi-instance/serverless deployment,
// so there's no cross-instance consistency problem to solve, and support-session requests are
// inherently low-volume (a human clicking "Request Session"), not a hot path that needs a
// durable/distributed limiter. Resets on app pool restart - acceptable for a soft abuse guard,
// not a security boundary on its own (the real boundary is requireRemoteSupportPermission()).
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;

const requestLog = new Map<number, number[]>();

export function checkRateLimit(userId: number, now: number = Date.now()): boolean {
  const recent = (requestLog.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    requestLog.set(userId, recent);
    return false;
  }
  recent.push(now);
  requestLog.set(userId, recent);
  return true;
}

// Test-only reset - the module-level Map otherwise leaks state across test cases.
export function _resetRateLimitForTests(): void {
  requestLog.clear();
}
