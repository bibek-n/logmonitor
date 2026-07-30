import { describe, it, expect, vi, beforeEach } from "vitest";

const dbRequest = { input: vi.fn(), query: vi.fn() };
const dbMock = { request: vi.fn(() => dbRequest), query: vi.fn() };
vi.mock("../db", () => ({
  getDb: vi.fn(async () => dbMock),
  sql: { NVarChar: "NVarChar", Int: "Int", VarChar: "VarChar" },
}));

import { writeAuditEvent, listAuditLog } from "./auditLog";

beforeEach(() => {
  dbRequest.input.mockReset().mockReturnValue(dbRequest);
  dbRequest.query.mockReset().mockResolvedValue({ recordset: [] });
  dbMock.request.mockClear();
  dbMock.query.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("writeAuditEvent — secret redaction", () => {
  it("writes the action field through untouched when it doesn't look like key material", async () => {
    await writeAuditEvent({ eventType: "CommandExecuted", userId: 1, username: "alice", action: "ls -la /var/www", result: "Success" });
    const actionCall = dbRequest.input.mock.calls.find((c) => c[0] === "action");
    expect(actionCall?.[2]).toBe("ls -la /var/www");
  });

  it("redacts an action that contains a PEM private-key header rather than persisting it", async () => {
    const leaked = "-----BEGIN OPENSSH PRIVATE KEY-----\nAAAAB3NzaC1yc2EAAAADAQABAAAB\n-----END OPENSSH PRIVATE KEY-----";
    await writeAuditEvent({ eventType: "CommandExecuted", userId: 1, username: "alice", action: leaked, result: "Success" });
    const actionCall = dbRequest.input.mock.calls.find((c) => c[0] === "action");
    expect(actionCall?.[2]).not.toContain("PRIVATE KEY");
    expect(actionCall?.[2]).toBe("[redacted - looked like key material]");
  });

  it("redacts regardless of key type header (RSA/EC/DSA/generic)", async () => {
    for (const header of ["RSA PRIVATE KEY", "EC PRIVATE KEY", "DSA PRIVATE KEY", "PRIVATE KEY"]) {
      dbRequest.input.mockClear();
      await writeAuditEvent({ eventType: "CommandExecuted", userId: 1, username: "alice", action: `-----BEGIN ${header}-----\nabc\n-----END ${header}-----`, result: "Success" });
      const actionCall = dbRequest.input.mock.calls.find((c) => c[0] === "action");
      expect(actionCall?.[2]).toBe("[redacted - looked like key material]");
    }
  });

  it("never includes a 'secret' or 'password' or 'privateKey' field in the insert at all", async () => {
    await writeAuditEvent({ eventType: "CredentialRevealed", userId: 1, username: "alice", action: "Credential #5", result: "Success" });
    const inputKeys = dbRequest.input.mock.calls.map((c) => c[0]);
    expect(inputKeys).not.toContain("secret");
    expect(inputKeys).not.toContain("password");
    expect(inputKeys).not.toContain("privateKey");
  });

  it("passes null through for optional fields that weren't supplied", async () => {
    await writeAuditEvent({ eventType: "SessionDisconnected", userId: null, username: null, result: "Success" });
    const protocolCall = dbRequest.input.mock.calls.find((c) => c[0] === "protocol");
    expect(protocolCall?.[2]).toBeNull();
  });
});

describe("listAuditLog", () => {
  it("caps an out-of-range limit at the 1000-row ceiling by falling back to the 200 default", async () => {
    dbRequest.query.mockResolvedValue({ recordset: [] });
    await listAuditLog({ limit: 5000 });
    const limitCall = dbRequest.input.mock.calls.find((c) => c[0] === "limit");
    expect(limitCall?.[2]).toBe(200);
  });

  it("passes through a valid limit within range", async () => {
    dbRequest.query.mockResolvedValue({ recordset: [] });
    await listAuditLog({ limit: 50 });
    const limitCall = dbRequest.input.mock.calls.find((c) => c[0] === "limit");
    expect(limitCall?.[2]).toBe(50);
  });

  it("filters by eventType when provided", async () => {
    dbRequest.query.mockResolvedValue({ recordset: [] });
    await listAuditLog({ eventType: "CredentialRevealed" });
    const eventTypeCall = dbRequest.input.mock.calls.find((c) => c[0] === "eventType");
    expect(eventTypeCall?.[2]).toBe("CredentialRevealed");
    expect(dbRequest.query.mock.calls[0][0]).toContain("WHERE EventType = @eventType");
  });
});
