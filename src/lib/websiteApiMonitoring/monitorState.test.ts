import { describe, it, expect } from "vitest";
import { evaluateCheckResult, type MonitorRuntimeState } from "./monitorState";
import type { WebsiteCheckResult } from "./types";

function baseState(overrides: Partial<MonitorRuntimeState> = {}): MonitorRuntimeState {
  return {
    status: "Up",
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    failureConfirmCount: 2,
    recoveryConfirmCount: 2,
    ...overrides,
  };
}

function successResult(totalMs = 100): WebsiteCheckResult {
  return {
    success: true,
    httpStatusCode: 200,
    dnsMs: 1,
    tcpMs: 1,
    tlsMs: null,
    ttfbMs: 1,
    totalMs,
    responseSizeBytes: 100,
    redirectCount: 0,
    finalUrl: "https://example.com",
    contentCheck: null,
    ssl: null,
    errorCode: null,
    errorMessage: null,
  };
}

function failureResult(): WebsiteCheckResult {
  return {
    success: false,
    httpStatusCode: null,
    dnsMs: null,
    tcpMs: null,
    tlsMs: null,
    ttfbMs: null,
    totalMs: null,
    responseSizeBytes: null,
    redirectCount: null,
    finalUrl: null,
    contentCheck: null,
    ssl: null,
    errorCode: "ECONNREFUSED",
    errorMessage: "connection refused",
  };
}

const config = { responseTimeWarningMs: 1000, responseTimeCriticalMs: 3000 };

describe("evaluateCheckResult", () => {
  it("stays Pending after a single failure below the confirm count", () => {
    const t = evaluateCheckResult(baseState({ status: "Up" }), failureResult(), config);
    expect(t.newStatus).toBe("Pending");
    expect(t.newConsecutiveFailures).toBe(1);
    expect(t.shouldOpenIncident).toBe(false);
  });

  it("flips to Down and opens an incident only after failureConfirmCount consecutive failures", () => {
    const afterFirst = evaluateCheckResult(baseState({ status: "Up" }), failureResult(), config);
    const afterSecond = evaluateCheckResult(
      baseState({ status: afterFirst.newStatus, consecutiveFailures: afterFirst.newConsecutiveFailures }),
      failureResult(),
      config
    );
    expect(afterSecond.newStatus).toBe("Down");
    expect(afterSecond.shouldOpenIncident).toBe(true);
  });

  it("does not re-open an incident on a further failure while already Down", () => {
    const t = evaluateCheckResult(baseState({ status: "Down", consecutiveFailures: 2 }), failureResult(), config);
    expect(t.newStatus).toBe("Down");
    expect(t.shouldOpenIncident).toBe(false);
  });

  it("resets the failure streak to zero on any intervening success (no partial banking)", () => {
    const afterOneFailure = evaluateCheckResult(baseState({ status: "Up" }), failureResult(), config);
    expect(afterOneFailure.newConsecutiveFailures).toBe(1);

    const afterSuccess = evaluateCheckResult(
      baseState({ status: afterOneFailure.newStatus, consecutiveFailures: afterOneFailure.newConsecutiveFailures }),
      successResult(),
      config
    );
    expect(afterSuccess.newConsecutiveFailures).toBe(0);

    // A subsequent failure must start the streak over at 1, not resume at 2.
    const afterNextFailure = evaluateCheckResult(
      baseState({ status: afterSuccess.newStatus, consecutiveFailures: afterSuccess.newConsecutiveFailures }),
      failureResult(),
      config
    );
    expect(afterNextFailure.newConsecutiveFailures).toBe(1);
    expect(afterNextFailure.newStatus).toBe("Pending");
  });

  it("requires recoveryConfirmCount consecutive successes before flipping back to Up and resolving", () => {
    const state = baseState({ status: "Down", consecutiveFailures: 2 });
    const afterFirstSuccess = evaluateCheckResult(state, successResult(), config);
    expect(afterFirstSuccess.newStatus).toBe("Down");
    expect(afterFirstSuccess.shouldResolveIncident).toBe(false);

    const afterSecondSuccess = evaluateCheckResult(
      { ...state, status: afterFirstSuccess.newStatus, consecutiveSuccesses: afterFirstSuccess.newConsecutiveSuccesses },
      successResult(),
      config
    );
    expect(afterSecondSuccess.newStatus).toBe("Up");
    expect(afterSecondSuccess.shouldResolveIncident).toBe(true);
  });

  it("resets the recovery streak on an intervening failure while Down (flapping)", () => {
    const state = baseState({ status: "Down", consecutiveFailures: 2 });
    const afterFirstSuccess = evaluateCheckResult(state, successResult(), config);
    expect(afterFirstSuccess.newConsecutiveSuccesses).toBe(1);

    const afterFailureAgain = evaluateCheckResult(
      { ...state, status: "Down", consecutiveSuccesses: afterFirstSuccess.newConsecutiveSuccesses },
      failureResult(),
      config
    );
    expect(afterFailureAgain.newConsecutiveSuccesses).toBe(0);
  });

  it("flags Degraded for a successful check slower than the warning threshold but not yet critical", () => {
    const t = evaluateCheckResult(baseState({ status: "Up" }), successResult(1500), config);
    expect(t.isDegraded).toBe(true);
    expect(t.newStatus).toBe("Degraded");
  });

  it("does not flag Degraded once response time reaches the critical threshold (that's a failure path, not Degraded)", () => {
    const t = evaluateCheckResult(baseState({ status: "Up" }), successResult(3500), config);
    expect(t.isDegraded).toBe(false);
    expect(t.newStatus).toBe("Up");
  });
});
