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
import { requireCodeQualityPermission, isCqSession, getCqSession, getCqAccess, CQ_PERMISSION_KEYS } from "./requireCodeQualityPermission";

function mockQueryResult(recordset: unknown[]) {
  dbRequest.query.mockResolvedValue({ recordset });
}

beforeEach(() => {
  vi.mocked(getServerSession).mockReset();
  dbRequest.input.mockReset().mockReturnValue(dbRequest);
  dbRequest.query.mockReset();
  dbMock.request.mockClear();
});

describe("requireCodeQualityPermission / getCqSession — unauthenticated or malformed session", () => {
  it("denies when there is no session at all", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const result = await requireCodeQualityPermission("cq_view");
    expect(isCqSession(result)).toBe(false);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("denies when the session has no role", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "alice" } } as never);
    expect(await getCqSession("cq_view")).toBeNull();
  });

  it("denies when the session has no username", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: "Developer" } } as never);
    expect(await getCqSession("cq_view")).toBeNull();
  });
});

describe("requireCodeQualityPermission — Admin bypass", () => {
  it("lets an Admin through without any RolePermissions lookup", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "admin", role: "Admin", id: "1" } } as never);
    const result = await requireCodeQualityPermission("cq_settings_manage");
    expect(isCqSession(result)).toBe(true);
    if (isCqSession(result)) {
      expect(result).toEqual({ userId: 1, username: "admin", role: "Admin" });
    }
    expect(dbRequest.query).not.toHaveBeenCalled();
  });
});

describe("requireCodeQualityPermission — non-Admin grant resolution", () => {
  it("allows when RolePermissions has an Allowed=true row for the role/key pair", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "dev1", role: "Developer", id: "7" } } as never);
    mockQueryResult([{ Allowed: true }]);
    const result = await requireCodeQualityPermission("cq_scan_start");
    expect(isCqSession(result)).toBe(true);
    if (isCqSession(result)) expect(result.userId).toBe(7);
  });

  it("denies when RolePermissions has an Allowed=false row", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "dev1", role: "Developer", id: "7" } } as never);
    mockQueryResult([{ Allowed: false }]);
    const result = await requireCodeQualityPermission("cq_project_delete");
    expect(isCqSession(result)).toBe(false);
  });

  it("denies when there is no grant row for the role/key pair", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "dev1", role: "Developer", id: "7" } } as never);
    mockQueryResult([]);
    const result = await requireCodeQualityPermission("cq_settings_manage");
    expect(isCqSession(result)).toBe(false);
  });
});

describe("resolveBaseSession — legacy sessions without a JWT id", () => {
  it("falls back to a Users table lookup by username when session.user.id is absent", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "legacyuser", role: "Admin" } } as never);
    mockQueryResult([{ Id: 42 }]);
    const result = await requireCodeQualityPermission("cq_view");
    expect(isCqSession(result)).toBe(true);
    if (isCqSession(result)) expect(result.userId).toBe(42);
  });

  it("denies when the username fallback lookup finds no matching user", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "ghost", role: "Admin" } } as never);
    mockQueryResult([]);
    const result = await requireCodeQualityPermission("cq_view");
    expect(isCqSession(result)).toBe(false);
  });
});

describe("getCqAccess", () => {
  it("returns every cq_* permission key as true for an Admin, without a grants query", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "admin", role: "Admin", id: "1" } } as never);
    const { cq, can } = await getCqAccess();
    expect(cq).not.toBeNull();
    for (const key of CQ_PERMISSION_KEYS) expect(can[key]).toBe(true);
    expect(dbRequest.query).not.toHaveBeenCalled();
  });

  it("returns only the granted keys as true for a non-Admin role, and null cq if cq_view isn't granted", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "dev1", role: "Developer", id: "9" } } as never);
    mockQueryResult([
      { PermissionKey: "cq_view", Allowed: true },
      { PermissionKey: "cq_scan_start", Allowed: true },
      { PermissionKey: "cq_project_delete", Allowed: false },
    ]);
    const { cq, can } = await getCqAccess();
    expect(cq).not.toBeNull();
    expect(can.cq_view).toBe(true);
    expect(can.cq_scan_start).toBe(true);
    expect(can.cq_project_delete).toBe(false);
    expect(can.cq_settings_manage).toBe(false);
  });

  it("returns cq: null when the role has no cq_view grant at all", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "outsider", role: "Employee", id: "3" } } as never);
    mockQueryResult([]);
    const { cq, can } = await getCqAccess();
    expect(cq).toBeNull();
    expect(can.cq_view).toBe(false);
  });

  it("ignores a grant row for a permission key outside the known CQ_PERMISSION_KEYS list", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "dev1", role: "Developer", id: "7" } } as never);
    mockQueryResult([
      { PermissionKey: "cq_view", Allowed: true },
      { PermissionKey: "some_unrelated_key", Allowed: true },
    ]);
    const { can } = await getCqAccess();
    expect(Object.keys(can).sort()).toEqual([...CQ_PERMISSION_KEYS].sort());
  });
});
