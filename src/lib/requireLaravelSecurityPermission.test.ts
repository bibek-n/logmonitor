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
import { requireLaravelSecurityPermission, isLsSession, getLsSession, getLsAccess, LS_PERMISSION_KEYS } from "./requireLaravelSecurityPermission";

function mockQueryResult(recordset: unknown[]) {
  dbRequest.query.mockResolvedValue({ recordset });
}

beforeEach(() => {
  vi.mocked(getServerSession).mockReset();
  dbRequest.input.mockReset().mockReturnValue(dbRequest);
  dbRequest.query.mockReset();
  dbMock.request.mockClear();
});

describe("requireLaravelSecurityPermission / getLsSession — unauthenticated or malformed session", () => {
  it("denies when there is no session at all", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const result = await requireLaravelSecurityPermission("ls_view");
    expect(isLsSession(result)).toBe(false);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("denies when the session has no role", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "alice" } } as never);
    expect(await getLsSession("ls_view")).toBeNull();
  });

  it("denies when the session has no username", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: "Developer" } } as never);
    expect(await getLsSession("ls_view")).toBeNull();
  });
});

describe("requireLaravelSecurityPermission — Admin bypass", () => {
  it("lets an Admin through without any RolePermissions lookup", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "admin", role: "Admin", id: "1" } } as never);
    const result = await requireLaravelSecurityPermission("ls_settings_manage");
    expect(isLsSession(result)).toBe(true);
    if (isLsSession(result)) {
      expect(result).toEqual({ userId: 1, username: "admin", role: "Admin" });
    }
    expect(dbRequest.query).not.toHaveBeenCalled();
  });
});

describe("requireLaravelSecurityPermission — non-Admin grant resolution", () => {
  it("allows when RolePermissions has an Allowed=true row for the role/key pair", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "dev1", role: "Developer", id: "7" } } as never);
    mockQueryResult([{ Allowed: true }]);
    const result = await requireLaravelSecurityPermission("ls_scan_start");
    expect(isLsSession(result)).toBe(true);
    if (isLsSession(result)) expect(result.userId).toBe(7);
  });

  it("denies when RolePermissions has an Allowed=false row", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "dev1", role: "Developer", id: "7" } } as never);
    mockQueryResult([{ Allowed: false }]);
    const result = await requireLaravelSecurityPermission("ls_project_delete");
    expect(isLsSession(result)).toBe(false);
  });

  it("denies when there is no grant row for the role/key pair", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "dev1", role: "Developer", id: "7" } } as never);
    mockQueryResult([]);
    const result = await requireLaravelSecurityPermission("ls_settings_manage");
    expect(isLsSession(result)).toBe(false);
  });
});

describe("resolveBaseSession — legacy sessions without a JWT id", () => {
  it("falls back to a Users table lookup by username when session.user.id is absent", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "legacyuser", role: "Admin" } } as never);
    mockQueryResult([{ Id: 42 }]);
    const result = await requireLaravelSecurityPermission("ls_view");
    expect(isLsSession(result)).toBe(true);
    if (isLsSession(result)) expect(result.userId).toBe(42);
  });

  it("denies when the username fallback lookup finds no matching user", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "ghost", role: "Admin" } } as never);
    mockQueryResult([]);
    const result = await requireLaravelSecurityPermission("ls_view");
    expect(isLsSession(result)).toBe(false);
  });
});

describe("getLsAccess", () => {
  it("returns every ls_* permission key as true for an Admin, without a grants query", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "admin", role: "Admin", id: "1" } } as never);
    const { ls, can } = await getLsAccess();
    expect(ls).not.toBeNull();
    for (const key of LS_PERMISSION_KEYS) expect(can[key]).toBe(true);
    expect(dbRequest.query).not.toHaveBeenCalled();
  });

  it("returns only the granted keys as true for a non-Admin role, and null ls if ls_view isn't granted", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "dev1", role: "Developer", id: "9" } } as never);
    mockQueryResult([
      { PermissionKey: "ls_view", Allowed: true },
      { PermissionKey: "ls_scan_start", Allowed: true },
      { PermissionKey: "ls_project_delete", Allowed: false },
    ]);
    const { ls, can } = await getLsAccess();
    expect(ls).not.toBeNull();
    expect(can.ls_view).toBe(true);
    expect(can.ls_scan_start).toBe(true);
    expect(can.ls_project_delete).toBe(false);
    expect(can.ls_settings_manage).toBe(false);
  });

  it("returns ls: null when the role has no ls_view grant at all", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "outsider", role: "Employee", id: "3" } } as never);
    mockQueryResult([]);
    const { ls, can } = await getLsAccess();
    expect(ls).toBeNull();
    expect(can.ls_view).toBe(false);
  });

  it("ignores a grant row for a permission key outside the known LS_PERMISSION_KEYS list", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "dev1", role: "Developer", id: "7" } } as never);
    mockQueryResult([
      { PermissionKey: "ls_view", Allowed: true },
      { PermissionKey: "some_unrelated_key", Allowed: true },
    ]);
    const { can } = await getLsAccess();
    expect(Object.keys(can).sort()).toEqual([...LS_PERMISSION_KEYS].sort());
  });
});
