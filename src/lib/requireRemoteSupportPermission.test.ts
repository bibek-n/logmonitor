import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("./authOptions", () => ({ authOptions: {} }));

const dbRequest = { input: vi.fn(), query: vi.fn() };
const dbMock = { request: vi.fn(() => dbRequest) };
vi.mock("./db", () => ({
  getDb: vi.fn(async () => dbMock),
  sql: { NVarChar: "NVarChar", Int: "Int", VarChar: "VarChar" },
}));

import { getServerSession } from "next-auth";
import {
  requireRemoteSupportPermission,
  isRemoteSupportSession,
  getRemoteSupportAccess,
  REMOTE_SUPPORT_PERMISSION_KEYS,
} from "./requireRemoteSupportPermission";

function mockSession(role: string, userId = 7) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { name: "alice", role, id: String(userId) } } as never);
}

beforeEach(() => {
  vi.mocked(getServerSession).mockReset();
  dbRequest.input.mockReset().mockReturnValue(dbRequest);
  dbRequest.query.mockReset();
  dbMock.request.mockClear();
});

describe("requireRemoteSupportPermission — unauthenticated", () => {
  it("denies when there is no session at all", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const result = await requireRemoteSupportPermission("remote_support_request");
    expect(isRemoteSupportSession(result)).toBe(false);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });
});

describe("requireRemoteSupportPermission — MFA gate", () => {
  it("denies a non-admin role even with the permission granted, if TOTP is not enabled", async () => {
    mockSession("Support");
    dbRequest.query.mockResolvedValueOnce({ recordset: [{ TotpEnabled: false }] }); // hasMfaEnabled check
    const result = await requireRemoteSupportPermission("remote_support_request");
    expect(isRemoteSupportSession(result)).toBe(false);
    // Must short-circuit before ever checking RolePermissions - only one query should run.
    expect(dbRequest.query).toHaveBeenCalledTimes(1);
  });

  it("denies an Admin role if that admin's own account does not have TOTP enabled", async () => {
    mockSession("Admin");
    dbRequest.query.mockResolvedValueOnce({ recordset: [{ TotpEnabled: false }] });
    const result = await requireRemoteSupportPermission("remote_support_admin");
    expect(isRemoteSupportSession(result)).toBe(false);
  });

  it("allows an Admin with TOTP enabled, without needing a RolePermissions row", async () => {
    mockSession("Admin");
    dbRequest.query.mockResolvedValueOnce({ recordset: [{ TotpEnabled: true }] });
    const result = await requireRemoteSupportPermission("remote_support_admin");
    expect(isRemoteSupportSession(result)).toBe(true);
    expect(dbRequest.query).toHaveBeenCalledTimes(1); // MFA check only, no RolePermissions lookup for Admin
  });
});

describe("requireRemoteSupportPermission — role-based grant resolution", () => {
  it("denies a non-admin role with TOTP enabled but no grant row for the key", async () => {
    mockSession("Support");
    dbRequest.query
      .mockResolvedValueOnce({ recordset: [{ TotpEnabled: true }] }) // MFA check
      .mockResolvedValueOnce({ recordset: [] }); // no RolePermissions row
    const result = await requireRemoteSupportPermission("remote_support_control");
    expect(isRemoteSupportSession(result)).toBe(false);
  });

  it("denies a non-admin role with an explicit Allowed=false row", async () => {
    mockSession("Support");
    dbRequest.query
      .mockResolvedValueOnce({ recordset: [{ TotpEnabled: true }] })
      .mockResolvedValueOnce({ recordset: [{ Allowed: false }] });
    const result = await requireRemoteSupportPermission("remote_support_control");
    expect(isRemoteSupportSession(result)).toBe(false);
  });

  it("allows a non-admin role with TOTP enabled and Allowed=true", async () => {
    mockSession("Support");
    dbRequest.query
      .mockResolvedValueOnce({ recordset: [{ TotpEnabled: true }] })
      .mockResolvedValueOnce({ recordset: [{ Allowed: true }] });
    const result = await requireRemoteSupportPermission("remote_support_control");
    expect(isRemoteSupportSession(result)).toBe(true);
    if (isRemoteSupportSession(result)) {
      expect(result.userId).toBe(7);
      expect(result.role).toBe("Support");
    }
  });
});

describe("getRemoteSupportAccess", () => {
  it("returns every key as false and session:null when MFA is not enabled", async () => {
    mockSession("Support");
    dbRequest.query.mockResolvedValueOnce({ recordset: [{ TotpEnabled: false }] });
    const access = await getRemoteSupportAccess();
    expect(access.session).toBeNull();
    expect(access.can).toEqual({});
  });

  it("returns all keys true for an MFA-enabled Admin", async () => {
    mockSession("Admin");
    dbRequest.query.mockResolvedValueOnce({ recordset: [{ TotpEnabled: true }] });
    const access = await getRemoteSupportAccess();
    expect(access.session).not.toBeNull();
    for (const key of REMOTE_SUPPORT_PERMISSION_KEYS) {
      expect(access.can[key]).toBe(true);
    }
  });
});
