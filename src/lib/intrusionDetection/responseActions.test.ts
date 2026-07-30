import { describe, it, expect, vi, beforeEach } from "vitest";

const dbRequest = { input: vi.fn(), query: vi.fn() };
const dbMock = { request: vi.fn(() => dbRequest), query: vi.fn() };
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(async () => dbMock),
  sql: { NVarChar: "NVarChar", Int: "Int", VarChar: "VarChar", Bit: "Bit", DateTime2: "DateTime2" },
}));

import { validateTarget, requestAction, executeAction, rollbackAction } from "./responseActions";

beforeEach(() => {
  dbRequest.input.mockReset().mockReturnValue(dbRequest);
  dbRequest.query.mockReset();
  dbMock.request.mockClear();
});

describe("validateTarget", () => {
  it("accepts a plain IPv4 address for block_ip", () => {
    expect(validateTarget("block_ip", "203.0.113.5")).toBeNull();
  });

  it("accepts a CIDR range for block_ip", () => {
    expect(validateTarget("block_ip", "203.0.113.0/24")).toBeNull();
  });

  it("rejects a value with shell-meaningful characters for block_ip", () => {
    expect(validateTarget("block_ip", "203.0.113.5; Remove-Item C:\\")).not.toBeNull();
  });

  it("accepts a well-formed username for disable_account", () => {
    expect(validateTarget("disable_account", "jdoe")).toBeNull();
    expect(validateTarget("disable_account", "j.doe-admin_2")).toBeNull();
  });

  it("rejects a username containing spaces or special characters", () => {
    expect(validateTarget("disable_account", "j doe; DROP TABLE Users")).not.toBeNull();
  });

  it("rejects an empty username", () => {
    expect(validateTarget("disable_account", "")).not.toBeNull();
  });
});

describe("requestAction", () => {
  it("rejects an invalid target without touching the database", async () => {
    const result = await requestAction({
      alertId: null,
      actionType: "block_ip",
      targetValue: "not an ip; rm -rf",
      requestedByUserId: 1,
      requestedByUsername: "admin",
      dryRun: true,
      expiresAt: null,
    });
    expect(result.ok).toBe(false);
    expect(dbMock.request).not.toHaveBeenCalled();
  });

  it("inserts a Simulated row when dryRun is true", async () => {
    dbRequest.query.mockResolvedValueOnce({ recordset: [{ Id: 42 }] });
    const result = await requestAction({
      alertId: null,
      actionType: "block_ip",
      targetValue: "203.0.113.5",
      requestedByUserId: 1,
      requestedByUsername: "admin",
      dryRun: true,
      expiresAt: null,
    });
    expect(result).toEqual({ ok: true, id: 42 });
    expect(dbRequest.input).toHaveBeenCalledWith("status", "VarChar", "Simulated");
  });

  it("inserts a Pending row when dryRun is false", async () => {
    dbRequest.query.mockResolvedValueOnce({ recordset: [{ Id: 7 }] });
    await requestAction({
      alertId: null,
      actionType: "disable_account",
      targetValue: "jdoe",
      requestedByUserId: 1,
      requestedByUsername: "admin",
      dryRun: false,
      expiresAt: null,
    });
    expect(dbRequest.input).toHaveBeenCalledWith("status", "VarChar", "Pending");
  });
});

describe("executeAction — block_ip", () => {
  it("adds the IP to the blocklist and marks the action Executed", async () => {
    dbRequest.query
      .mockResolvedValueOnce({ recordset: [{ Id: 1, ActionType: "block_ip", TargetValue: "203.0.113.5", Status: "Pending" }] }) // load action
      .mockResolvedValueOnce({ recordset: [] }) // not already blocked
      .mockResolvedValueOnce({ recordset: [] }) // insert into blocklist
      .mockResolvedValueOnce({ recordset: [] }); // update action to Executed

    const result = await executeAction(1, { userId: 9 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.result).toContain("203.0.113.5");

    const lastCallArgs = dbRequest.query.mock.calls[3][0] as string;
    expect(lastCallArgs).toContain("Status = 'Executed'");
  });

  it("refuses to execute an already-Executed action", async () => {
    dbRequest.query.mockResolvedValueOnce({ recordset: [{ Id: 1, ActionType: "block_ip", TargetValue: "203.0.113.5", Status: "Executed" }] });
    const result = await executeAction(1, { userId: 9 });
    expect(result.ok).toBe(false);
  });

  it("returns an error when the action id does not exist", async () => {
    dbRequest.query.mockResolvedValueOnce({ recordset: [] });
    const result = await executeAction(999, { userId: 9 });
    expect(result.ok).toBe(false);
  });
});

describe("rollbackAction — block_ip", () => {
  it("deactivates the blocklist entry and marks the action RolledBack", async () => {
    dbRequest.query
      .mockResolvedValueOnce({ recordset: [{ Id: 1, ActionType: "block_ip", TargetValue: "203.0.113.5", Status: "Executed" }] }) // load action
      .mockResolvedValueOnce({ recordset: [] }) // deactivate blocklist entry
      .mockResolvedValueOnce({ recordset: [] }); // update action to RolledBack

    const result = await rollbackAction(1);
    expect(result.ok).toBe(true);

    const lastCallArgs = dbRequest.query.mock.calls[2][0] as string;
    expect(lastCallArgs).toContain("RolledBack");
  });

  it("refuses to roll back an action that was never executed", async () => {
    dbRequest.query.mockResolvedValueOnce({ recordset: [{ Id: 1, ActionType: "block_ip", TargetValue: "203.0.113.5", Status: "Simulated" }] });
    const result = await rollbackAction(1);
    expect(result.ok).toBe(false);
  });
});
