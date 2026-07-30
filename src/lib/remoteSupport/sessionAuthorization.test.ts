import { describe, it, expect, vi, beforeEach } from "vitest";

const dbRequest = { input: vi.fn(), query: vi.fn() };
const dbMock = { request: vi.fn(() => dbRequest) };
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(async () => dbMock),
  sql: { NVarChar: "NVarChar", Int: "Int", VarChar: "VarChar", Bit: "Bit", DateTime2: "DateTime2", BigInt: "BigInt" },
}));

import {
  createSessionRequest,
  respondToSessionRequest,
  endSession,
} from "./sessionAuthorization";
import { SessionStateError } from "./types";

beforeEach(() => {
  dbRequest.input.mockReset().mockReturnValue(dbRequest);
  dbRequest.query.mockReset();
  dbMock.request.mockClear();
});

function queryTextOf(callIndex: number): string {
  return dbRequest.query.mock.calls[callIndex][0] as string;
}

describe("createSessionRequest — a request alone can never start a live session", () => {
  it("only ever inserts a row relying on the table's Pending default, never binding an Active status", async () => {
    dbRequest.query
      .mockResolvedValueOnce({ recordset: [{ LastHeartbeat: new Date().toISOString() }] }) // device online
      .mockResolvedValueOnce({ recordset: [{ Cnt: 0 }] }) // no existing pending/active session
      .mockResolvedValueOnce({ recordset: [{ Id: 42, SessionGuid: "guid-1" }] }) // insert
      .mockResolvedValueOnce({ recordset: [] }); // logSessionEvent insert

    const result = await createSessionRequest({
      deviceId: "dev-1",
      requestedByUserId: 9,
      reason: "Printer troubleshooting",
      sourceIp: "10.0.0.5",
    });

    expect(result).toEqual({ sessionId: 42, sessionGuid: "guid-1", expiresAt: expect.any(String) });

    const insertQuery = queryTextOf(2);
    expect(insertQuery).toContain("INSERT INTO RemoteSupportSessions");
    expect(insertQuery).not.toMatch(/Active/i);
  });

  it("refuses to queue a request for an offline device", async () => {
    dbRequest.query.mockResolvedValueOnce({ recordset: [{ LastHeartbeat: null }] });
    await expect(
      createSessionRequest({ deviceId: "dev-1", requestedByUserId: 9, reason: "x", sourceIp: "1.2.3.4" })
    ).rejects.toMatchObject({ code: "DEVICE_OFFLINE" });
  });

  it("refuses a second request while one is already pending/active for the same device", async () => {
    dbRequest.query
      .mockResolvedValueOnce({ recordset: [{ LastHeartbeat: new Date().toISOString() }] })
      .mockResolvedValueOnce({ recordset: [{ Cnt: 1 }] });
    await expect(
      createSessionRequest({ deviceId: "dev-1", requestedByUserId: 9, reason: "x", sourceIp: "1.2.3.4" })
    ).rejects.toMatchObject({ code: "DEVICE_BUSY" });
  });
});

describe("respondToSessionRequest — a session cannot begin without valid employee approval", () => {
  const futureExpiry = new Date(Date.now() + 60_000).toISOString();
  const pastExpiry = new Date(Date.now() - 60_000).toISOString();

  function pendingRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      Id: 1,
      DeviceId: "dev-1",
      Status: "Pending",
      ApprovalNonce: "correct-nonce",
      ExpiresAt: futureExpiry,
      ...overrides,
    };
  }

  it("transitions to Active only when approved:true with the exact matching nonce", async () => {
    dbRequest.query
      .mockResolvedValueOnce({ recordset: [pendingRow()] }) // select
      .mockResolvedValueOnce({ rowsAffected: [1] }) // update
      .mockResolvedValueOnce({ recordset: [] }); // event log

    const result = await respondToSessionRequest({ sessionId: 1, deviceId: "dev-1", nonce: "correct-nonce", approved: true });
    expect(result.status).toBe("Active");
    expect(queryTextOf(1)).toContain("Status = @status");
  });

  it("never moves to Active on rejection, even with the correct nonce", async () => {
    dbRequest.query
      .mockResolvedValueOnce({ recordset: [pendingRow()] })
      .mockResolvedValueOnce({ rowsAffected: [1] })
      .mockResolvedValueOnce({ recordset: [] });

    const result = await respondToSessionRequest({ sessionId: 1, deviceId: "dev-1", nonce: "correct-nonce", approved: false });
    expect(result.status).toBe("Rejected");
    expect(result.iceServers).toBeUndefined();
  });

  it("rejects an approval attempt with the wrong nonce and never issues an UPDATE at all", async () => {
    dbRequest.query.mockResolvedValueOnce({ recordset: [pendingRow()] });

    await expect(
      respondToSessionRequest({ sessionId: 1, deviceId: "dev-1", nonce: "guessed-wrong-nonce", approved: true })
    ).rejects.toMatchObject({ code: "BAD_NONCE" });

    // Only the initial SELECT should have run - no state change was ever attempted.
    expect(dbRequest.query).toHaveBeenCalledTimes(1);
  });

  it("rejects approval from a device the session wasn't requested for", async () => {
    dbRequest.query.mockResolvedValueOnce({ recordset: [pendingRow({ DeviceId: "dev-1" })] });
    await expect(
      respondToSessionRequest({ sessionId: 1, deviceId: "some-other-device", nonce: "correct-nonce", approved: true })
    ).rejects.toMatchObject({ code: "DEVICE_MISMATCH" });
    expect(dbRequest.query).toHaveBeenCalledTimes(1);
  });

  it("refuses to approve a session that already left the Pending state (no re-approval / replay)", async () => {
    dbRequest.query.mockResolvedValueOnce({ recordset: [pendingRow({ Status: "Active" })] });
    await expect(
      respondToSessionRequest({ sessionId: 1, deviceId: "dev-1", nonce: "correct-nonce", approved: true })
    ).rejects.toMatchObject({ code: "NOT_PENDING" });
    expect(dbRequest.query).toHaveBeenCalledTimes(1);
  });
});

describe("respondToSessionRequest — expired requests cannot be approved late", () => {
  it("marks the session Expired and refuses approval once ExpiresAt has passed, even with the correct nonce", async () => {
    dbRequest.query
      .mockResolvedValueOnce({
        recordset: [{ Id: 1, DeviceId: "dev-1", Status: "Pending", ApprovalNonce: "correct-nonce", ExpiresAt: new Date(Date.now() - 1000).toISOString() }],
      })
      .mockResolvedValueOnce({ rowsAffected: [1] }) // markExpired's UPDATE
      .mockResolvedValueOnce({ recordset: [] }); // markExpired's event log

    await expect(
      respondToSessionRequest({ sessionId: 1, deviceId: "dev-1", nonce: "correct-nonce", approved: true })
    ).rejects.toMatchObject({ code: "EXPIRED" });

    expect(queryTextOf(1)).toContain("Status = 'Expired'");
  });
});

describe("endSession — an ended session's credentials cannot be reused", () => {
  it("ends an Active session successfully", async () => {
    dbRequest.query
      .mockResolvedValueOnce({ rowsAffected: [1] })
      .mockResolvedValueOnce({ recordset: [] });
    await expect(endSession({ sessionId: 1, terminationReason: "EmployeeEnded" })).resolves.toBeUndefined();
  });

  it("refuses to end a session a second time (no re-ending an already-Ended session)", async () => {
    dbRequest.query.mockResolvedValueOnce({ rowsAffected: [0] }); // WHERE Status IN ('Approved','Active') matches nothing
    await expect(endSession({ sessionId: 1, terminationReason: "AdminEnded" })).rejects.toMatchObject({ code: "NOT_ACTIVE" });
  });

  it("refuses to end a session that was never approved in the first place", async () => {
    dbRequest.query.mockResolvedValueOnce({ rowsAffected: [0] });
    await expect(endSession({ sessionId: 2, terminationReason: "AdminEnded" })).rejects.toBeInstanceOf(SessionStateError);
  });
});
