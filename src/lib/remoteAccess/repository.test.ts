import { describe, it, expect, vi, beforeEach } from "vitest";

const dbRequest = { input: vi.fn(), query: vi.fn() };
const dbMock = { request: vi.fn(() => dbRequest), query: vi.fn() };
vi.mock("../db", () => ({
  getDb: vi.fn(async () => dbMock),
  sql: { NVarChar: "NVarChar", VarChar: (n?: unknown) => "VarChar", Int: "Int", Bit: "Bit", DateTime2: "DateTime2", MAX: "MAX" },
}));

vi.mock("./crypto", () => ({
  encryptSecret: vi.fn(async (s: string) => `enc:${s}`),
  decryptSecret: vi.fn(async (s: string) => s.replace(/^enc:/, "")),
}));

import {
  listCredentials,
  getCredentialSecret,
  listSshKeys,
  getSshPrivateKey,
  listConnections,
  listConnectionsForCheck,
} from "./repository";

beforeEach(() => {
  dbRequest.input.mockReset().mockReturnValue(dbRequest);
  dbRequest.query.mockReset().mockResolvedValue({ recordset: [] });
  dbMock.request.mockClear();
  dbMock.query.mockReset().mockResolvedValue({ recordset: [] });
});

describe("Credentials vault — structural redaction", () => {
  it("listCredentials never selects the EncryptedSecret column", async () => {
    await listCredentials();
    const sqlText = dbMock.query.mock.calls[0][0] as string;
    expect(sqlText).not.toContain("EncryptedSecret");
    expect(sqlText).toContain("SELECT");
  });

  it("listCredentials filters out soft-deleted rows", async () => {
    await listCredentials();
    const sqlText = dbMock.query.mock.calls[0][0] as string;
    expect(sqlText).toContain("WHERE IsDeleted = 0");
  });

  it("getCredentialSecret is the only path that selects EncryptedSecret, and decrypts it", async () => {
    dbRequest.query.mockResolvedValue({ recordset: [{ EncryptedSecret: "enc:hunter2", Name: "root-password" }] });
    const revealed = await getCredentialSecret(5);
    const sqlText = dbRequest.query.mock.calls[0][0] as string;
    expect(sqlText).toContain("EncryptedSecret");
    expect(revealed).toEqual({ secret: "hunter2", name: "root-password" });
  });

  it("getCredentialSecret returns null for a nonexistent or soft-deleted credential", async () => {
    dbRequest.query.mockResolvedValue({ recordset: [] });
    expect(await getCredentialSecret(999)).toBeNull();
  });
});

describe("SSH Keys — structural redaction", () => {
  it("listSshKeys never selects the EncryptedPrivateKey column", async () => {
    await listSshKeys();
    const sqlText = dbMock.query.mock.calls[0][0] as string;
    expect(sqlText).not.toContain("EncryptedPrivateKey");
  });

  it("listSshKeys filters out soft-deleted rows", async () => {
    await listSshKeys();
    const sqlText = dbMock.query.mock.calls[0][0] as string;
    expect(sqlText).toContain("WHERE IsDeleted = 0");
  });

  it("getSshPrivateKey is the only path that selects EncryptedPrivateKey, and decrypts it", async () => {
    dbRequest.query.mockResolvedValue({ recordset: [{ EncryptedPrivateKey: "enc:-----BEGIN KEY-----", Name: "prod-key" }] });
    const revealed = await getSshPrivateKey(3);
    const sqlText = dbRequest.query.mock.calls[0][0] as string;
    expect(sqlText).toContain("EncryptedPrivateKey");
    expect(revealed).toEqual({ privateKeyPem: "-----BEGIN KEY-----", name: "prod-key" });
  });
});

describe("Connections — soft delete + active filtering", () => {
  it("listConnections filters out soft-deleted rows by default", async () => {
    await listConnections();
    const sqlText = dbRequest.query.mock.calls[0][0] as string;
    expect(sqlText).toContain("IsDeleted = 0");
  });

  it("listConnectionsForCheck only returns active, non-deleted connections", async () => {
    await listConnectionsForCheck();
    const sqlText = dbMock.query.mock.calls[0][0] as string;
    expect(sqlText).toContain("IsDeleted = 0");
    expect(sqlText).toContain("IsActive = 1");
  });
});
