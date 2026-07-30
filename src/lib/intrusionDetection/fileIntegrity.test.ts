import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";

const dbRequest = { input: vi.fn(), query: vi.fn() };
const dbMock = { request: vi.fn(() => dbRequest), query: vi.fn() };
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(async () => dbMock),
  sql: { NVarChar: "NVarChar", Int: "Int", VarChar: "VarChar", BigInt: "BigInt", Char: () => "Char" },
}));

import { snapshotFile, addBaseline } from "./fileIntegrity";

beforeEach(() => {
  dbRequest.input.mockReset().mockReturnValue(dbRequest);
  dbRequest.query.mockReset();
  dbMock.request.mockClear();
});

describe("snapshotFile", () => {
  let tmpFile: string;

  afterEach(async () => {
    if (tmpFile) await fs.rm(tmpFile, { force: true });
  });

  it("returns a matching sha256 hash and byte size for a real file", async () => {
    tmpFile = path.join(os.tmpdir(), `ids-fim-test-${Date.now()}.txt`);
    const content = "hello intrusion detection file integrity monitoring";
    await fs.writeFile(tmpFile, content);

    const snapshot = await snapshotFile(tmpFile);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.sha256Hash).toBe(crypto.createHash("sha256").update(content).digest("hex"));
    expect(snapshot?.sizeBytes).toBe(Buffer.byteLength(content));
  });

  it("detects a change when the file content is modified", async () => {
    tmpFile = path.join(os.tmpdir(), `ids-fim-test-${Date.now()}.txt`);
    await fs.writeFile(tmpFile, "version 1");
    const before = await snapshotFile(tmpFile);

    await fs.writeFile(tmpFile, "version 2 - different content");
    const after = await snapshotFile(tmpFile);

    expect(before?.sha256Hash).not.toBe(after?.sha256Hash);
  });

  it("returns null for a file that does not exist", async () => {
    const snapshot = await snapshotFile(path.join(os.tmpdir(), "this-file-does-not-exist-12345.txt"));
    expect(snapshot).toBeNull();
  });
});

describe("addBaseline", () => {
  it("rejects an unreadable path without touching the database", async () => {
    const result = await addBaseline(path.join(os.tmpdir(), "definitely-does-not-exist-98765.txt"), 1);
    expect(result.ok).toBe(false);
    expect(dbMock.request).not.toHaveBeenCalled();
  });

  it("rejects a path that is already baselined", async () => {
    const tmpFile = path.join(os.tmpdir(), `ids-fim-test-dup-${Date.now()}.txt`);
    await fs.writeFile(tmpFile, "content");
    try {
      dbRequest.query.mockResolvedValueOnce({ recordset: [{ Id: 5 }] }); // already exists
      const result = await addBaseline(tmpFile, 1);
      expect(result.ok).toBe(false);
    } finally {
      await fs.rm(tmpFile, { force: true });
    }
  });
});
