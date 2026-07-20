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
import { requireQaPermission, isQaSession, getQaSession, getQaAccess, QA_PERMISSION_KEYS } from "./requireQaPermission";

function mockQueryResult(recordset: unknown[]) {
  dbRequest.query.mockResolvedValue({ recordset });
}

beforeEach(() => {
  vi.mocked(getServerSession).mockReset();
  dbRequest.input.mockReset().mockReturnValue(dbRequest);
  dbRequest.query.mockReset();
  dbMock.request.mockClear();
});

describe("requireQaPermission / getQaSession — unauthenticated or malformed session", () => {
  it("denies when there is no session at all", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const result = await requireQaPermission("qa_view");
    expect(isQaSession(result)).toBe(false);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("denies when the session has no role", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "alice" } } as never);
    expect(await getQaSession("qa_view")).toBeNull();
  });

  it("denies when the session has no username", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: "Tester" } } as never);
    expect(await getQaSession("qa_view")).toBeNull();
  });
});

describe("requireQaPermission — Admin bypass", () => {
  it("lets an Admin through without any RolePermissions lookup", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "admin", role: "Admin", id: "1" } } as never);
    const result = await requireQaPermission("qa_admin");
    expect(isQaSession(result)).toBe(true);
    if (isQaSession(result)) {
      expect(result).toEqual({ userId: 1, username: "admin", role: "Admin" });
    }
    // The bypass must not need a grants row — no query should have run for this call.
    expect(dbRequest.query).not.toHaveBeenCalled();
  });
});

describe("requireQaPermission — non-Admin grant resolution", () => {
  it("allows when RolePermissions has an Allowed=true row for the role/key pair", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "tester1", role: "Tester", id: "7" } } as never);
    mockQueryResult([{ Allowed: true }]);
    const result = await requireQaPermission("qa_execute");
    expect(isQaSession(result)).toBe(true);
    if (isQaSession(result)) expect(result.userId).toBe(7);
  });

  it("denies when RolePermissions has an Allowed=false row", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "tester1", role: "Tester", id: "7" } } as never);
    mockQueryResult([{ Allowed: false }]);
    const result = await requireQaPermission("qa_delete");
    expect(isQaSession(result)).toBe(false);
  });

  it("denies when there is no grant row for the role/key pair", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "tester1", role: "Tester", id: "7" } } as never);
    mockQueryResult([]);
    const result = await requireQaPermission("qa_admin");
    expect(isQaSession(result)).toBe(false);
  });
});

describe("resolveBaseSession — legacy sessions without a JWT id", () => {
  it("falls back to a Users table lookup by username when session.user.id is absent", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "legacyuser", role: "Admin" } } as never);
    mockQueryResult([{ Id: 42 }]);
    const result = await requireQaPermission("qa_view");
    expect(isQaSession(result)).toBe(true);
    if (isQaSession(result)) expect(result.userId).toBe(42);
  });

  it("denies when the username fallback lookup finds no matching user", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "ghost", role: "Admin" } } as never);
    mockQueryResult([]);
    const result = await requireQaPermission("qa_view");
    expect(isQaSession(result)).toBe(false);
  });
});

describe("getQaAccess", () => {
  it("returns every permission key as true for an Admin, without a grants query", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "admin", role: "Admin", id: "1" } } as never);
    const { qa, can } = await getQaAccess();
    expect(qa).not.toBeNull();
    for (const key of QA_PERMISSION_KEYS) expect(can[key]).toBe(true);
    expect(dbRequest.query).not.toHaveBeenCalled();
  });

  it("returns only the granted keys as true for a non-Admin role, and null qa if qa_view isn't granted", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "dev1", role: "Developer", id: "9" } } as never);
    mockQueryResult([
      { PermissionKey: "qa_view", Allowed: true },
      { PermissionKey: "qa_manage_bugs", Allowed: true },
      { PermissionKey: "qa_delete", Allowed: false },
    ]);
    const { qa, can } = await getQaAccess();
    expect(qa).not.toBeNull();
    expect(can.qa_view).toBe(true);
    expect(can.qa_manage_bugs).toBe(true);
    expect(can.qa_delete).toBe(false);
    expect(can.qa_admin).toBe(false);
  });

  it("returns qa: null when the role has no qa_view grant at all", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "outsider", role: "Employee", id: "3" } } as never);
    mockQueryResult([]);
    const { qa, can } = await getQaAccess();
    expect(qa).toBeNull();
    expect(can.qa_view).toBe(false);
  });

  it("ignores a grant row for a permission key outside the known QA_PERMISSION_KEYS list", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "tester1", role: "Tester", id: "7" } } as never);
    mockQueryResult([
      { PermissionKey: "qa_view", Allowed: true },
      { PermissionKey: "some_unrelated_key", Allowed: true },
    ]);
    const { can } = await getQaAccess();
    expect(Object.keys(can).sort()).toEqual([...QA_PERMISSION_KEYS].sort());
  });
});
