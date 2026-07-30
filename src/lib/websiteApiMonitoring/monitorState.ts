import { MonitorStatus, WebsiteMonitorConfig } from "./types";

export interface MonitorRuntimeState {
  status: MonitorStatus;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  failureConfirmCount: number;
  recoveryConfirmCount: number;
}

export interface MonitorStateTransition {
  newStatus: MonitorStatus;
  newConsecutiveFailures: number;
  newConsecutiveSuccesses: number;
  shouldOpenIncident: boolean;
  shouldResolveIncident: boolean;
  isDegraded: boolean;
}

// The failure/recovery-confirmation state machine (spec section 14): a single failed check
// never immediately declares downtime - it takes `failureConfirmCount` CONSECUTIVE failures
// before the monitor flips to Down and an incident opens, and `recoveryConfirmCount`
// consecutive successes before it flips back to Up and any open incident resolves. Any
// intervening success resets the failure streak to zero (and vice versa), so a monitor that
// fails once, succeeds once, then fails again never "banks" partial progress toward either
// threshold - each streak has to be built fresh. Pure function, no DB/IO, fully unit-testable.
export function evaluateCheckResult(
  state: MonitorRuntimeState,
  // Structural, not WebsiteCheckResult specifically - ApiCheckResult shares these two fields
  // and this state machine is otherwise identical for both monitor types.
  result: { success: boolean; totalMs: number | null },
  config: Pick<WebsiteMonitorConfig, "responseTimeWarningMs" | "responseTimeCriticalMs">
): MonitorStateTransition {
  if (result.success) {
    const newConsecutiveSuccesses = state.consecutiveSuccesses + 1;
    const wasDown = state.status === "Down" || state.status === "Pending";
    const recovered = wasDown && newConsecutiveSuccesses >= state.recoveryConfirmCount;

    // Degraded is a performance signal, independent of the up/down confirmation streak - a
    // successful check that's merely slow doesn't touch the failure/recovery counters at all.
    const isDegraded = result.totalMs !== null && result.totalMs >= config.responseTimeWarningMs && result.totalMs < config.responseTimeCriticalMs;

    let newStatus: MonitorStatus;
    if (wasDown && !recovered) {
      newStatus = "Down"; // still building the recovery streak
    } else {
      newStatus = isDegraded ? "Degraded" : "Up";
    }

    return {
      newStatus,
      newConsecutiveFailures: 0,
      newConsecutiveSuccesses,
      shouldOpenIncident: false,
      shouldResolveIncident: recovered,
      isDegraded,
    };
  }

  const newConsecutiveFailures = state.consecutiveFailures + 1;
  const confirmedDown = newConsecutiveFailures >= state.failureConfirmCount;
  const wasAlreadyDown = state.status === "Down";

  return {
    newStatus: confirmedDown ? "Down" : "Pending",
    newConsecutiveFailures,
    newConsecutiveSuccesses: 0,
    shouldOpenIncident: confirmedDown && !wasAlreadyDown,
    shouldResolveIncident: false,
    isDegraded: false,
  };
}
