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
  requireBrowserActivityPermission,
  isBrowserActivitySession,
  getBrowserActivitySession,
  getBrowserActivityAccess,
  BROWSER_ACTIVITY_PERMISSION_KEYS,
} from "./requireBrowserActivityPermission";

function mockQueryResult(recordset: unknown[]) {
  dbRequest.query.mockResolvedValue({ recordset });
}

beforeEach(() => {
  vi.mocked(getServerSession).mockReset();
  dbRequest.input.mockReset().mockReturnValue(dbRequest);
  dbRequest.query.mockReset();
  dbMock.request.mockClear();
});

describe("requireBrowserActivityPermission / getBrowserActivitySession — unauthenticated or malformed session", () => {
  it("denies when there is no session at all", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const result = await requireBrowserActivityPermission("ba_view");
    expect(isBrowserActivitySession(result)).toBe(false);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("denies when the session has no role", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "alice" } } as never);
    expect(await getBrowserActivitySession("ba_view")).toBeNull();
  });

  it("denies when the session has no username", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: "SecurityAdministrator" } } as never);
    expect(await getBrowserActivitySession("ba_view")).toBeNull();
  });
});

describe("requireBrowserActivityPermission — Admin bypass", () => {
  it("lets an Admin through without any RolePermissions lookup", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "admin", role: "Admin", id: "1" } } as never);
    const result = await requireBrowserActivityPermission("ba_settings_manage");
    expect(isBrowserActivitySession(result)).toBe(true);
    if (isBrowserActivitySession(result)) {
      expect(result).toEqual({ userId: 1, username: "admin", role: "Admin" });
    }
    expect(dbRequest.query).not.toHaveBeenCalled();
  });
});

describe("requireBrowserActivityPermission — non-Admin grant resolution", () => {
  it("allows when RolePermissions has an Allowed=true row for the role/key pair", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "hr1", role: "HRReviewer", id: "7" } } as never);
    mockQueryResult([{ Allowed: true }]);
    const result = await requireBrowserActivityPermission("ba_view");
    expect(isBrowserActivitySession(result)).toBe(true);
    if (isBrowserActivitySession(result)) expect(result.userId).toBe(7);
  });

  it("denies when RolePermissions has an Allowed=false row", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "hr1", role: "HRReviewer", id: "7" } } as never);
    mockQueryResult([{ Allowed: false }]);
    const result = await requireBrowserActivityPermission("ba_export");
    expect(isBrowserActivitySession(result)).toBe(false);
  });

  it("denies when there is no grant row for the role/key pair", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "hr1", role: "HRReviewer", id: "7" } } as never);
    mockQueryResult([]);
    const result = await requireBrowserActivityPermission("ba_settings_manage");
    expect(isBrowserActivitySession(result)).toBe(false);
  });

  it("keeps ba_view_page_titles and ba_view isolated - one grant doesn't imply the other", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "auditor", role: "ReadOnlyAuditor", id: "5" } } as never);
    mockQueryResult([{ Allowed: true }]);
    const viewResult = await requireBrowserActivityPermission("ba_view");
    expect(isBrowserActivitySession(viewResult)).toBe(true);

    mockQueryResult([]);
    const titlesResult = await requireBrowserActivityPermission("ba_view_page_titles");
    expect(isBrowserActivitySession(titlesResult)).toBe(false);
  });
});

describe("resolveBaseSession — legacy sessions without a JWT id", () => {
  it("falls back to a Users table lookup by username when session.user.id is absent", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "legacyuser", role: "Admin" } } as never);
    mockQueryResult([{ Id: 42 }]);
    const result = await requireBrowserActivityPermission("ba_view");
    expect(isBrowserActivitySession(result)).toBe(true);
    if (isBrowserActivitySession(result)) expect(result.userId).toBe(42);
  });

  it("denies when the username fallback lookup finds no matching user", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "ghost", role: "Admin" } } as never);
    mockQueryResult([]);
    const result = await requireBrowserActivityPermission("ba_view");
    expect(isBrowserActivitySession(result)).toBe(false);
  });
});

describe("getBrowserActivityAccess", () => {
  it("returns every ba_* permission key as true for an Admin, without a grants query", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "admin", role: "Admin", id: "1" } } as never);
    const { browserActivity, can } = await getBrowserActivityAccess();
    expect(browserActivity).not.toBeNull();
    for (const key of BROWSER_ACTIVITY_PERMISSION_KEYS) expect(can[key]).toBe(true);
    expect(dbRequest.query).not.toHaveBeenCalled();
  });

  it("returns only the granted keys as true for a non-Admin role, and null browserActivity if ba_view isn't granted", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "sec1", role: "SecurityAdministrator", id: "9" } } as never);
    mockQueryResult([
      { PermissionKey: "ba_view", Allowed: true },
      { PermissionKey: "ba_export", Allowed: true },
      { PermissionKey: "ba_delete", Allowed: false },
    ]);
    const { browserActivity, can } = await getBrowserActivityAccess();
    expect(browserActivity).not.toBeNull();
    expect(can.ba_view).toBe(true);
    expect(can.ba_export).toBe(true);
    expect(can.ba_delete).toBe(false);
    expect(can.ba_settings_manage).toBe(false);
  });

  it("returns browserActivity: null when the role has no ba_view grant at all", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "outsider", role: "Employee", id: "3" } } as never);
    mockQueryResult([]);
    const { browserActivity, can } = await getBrowserActivityAccess();
    expect(browserActivity).toBeNull();
    expect(can.ba_view).toBe(false);
  });

  it("ignores a grant row for a permission key outside the known BROWSER_ACTIVITY_PERMISSION_KEYS list", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: "sec1", role: "SecurityAdministrator", id: "7" } } as never);
    mockQueryResult([
      { PermissionKey: "ba_view", Allowed: true },
      { PermissionKey: "some_unrelated_key", Allowed: true },
    ]);
    const { can } = await getBrowserActivityAccess();
    expect(Object.keys(can).sort()).toEqual([...BROWSER_ACTIVITY_PERMISSION_KEYS].sort());
  });
});
