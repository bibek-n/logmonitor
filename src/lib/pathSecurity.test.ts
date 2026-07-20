import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { validateSourcePath } from "./pathSecurity";

describe("validateSourcePath", () => {
  let allowedRoot: string;
  let outsideDir: string;

  beforeEach(() => {
    allowedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "repo-allowed-"));
    outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "repo-outside-"));
    delete process.env.CODE_QUALITY_SCAN_ROOTS;
    process.env.REPO_SCAN_ROOTS = allowedRoot;
  });

  afterEach(() => {
    delete process.env.REPO_SCAN_ROOTS;
    delete process.env.CODE_QUALITY_SCAN_ROOTS;
    fs.rmSync(allowedRoot, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  });

  it("accepts a path exactly equal to an allowed root", () => {
    expect(validateSourcePath(allowedRoot).ok).toBe(true);
  });

  it("accepts a subdirectory nested inside an allowed root", () => {
    const nested = path.join(allowedRoot, "src", "lib");
    fs.mkdirSync(nested, { recursive: true });
    expect(validateSourcePath(nested).ok).toBe(true);
  });

  it("rejects a directory outside every configured root", () => {
    const result = validateSourcePath(outsideDir);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("outside the approved scan roots");
  });

  it("rejects a path that does not exist", () => {
    const result = validateSourcePath(path.join(allowedRoot, "does-not-exist"));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("does not exist");
  });

  it("rejects a path that points to a file rather than a directory", () => {
    const filePath = path.join(allowedRoot, "notadir.txt");
    fs.writeFileSync(filePath, "x");
    const result = validateSourcePath(filePath);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("must be a directory");
  });

  it("rejects an empty or blank source path", () => {
    expect(validateSourcePath("").ok).toBe(false);
    expect(validateSourcePath("   ").ok).toBe(false);
  });

  it("supports multiple semicolon-separated roots", () => {
    process.env.REPO_SCAN_ROOTS = `${outsideDir};${allowedRoot}`;
    expect(validateSourcePath(allowedRoot).ok).toBe(true);
    expect(validateSourcePath(outsideDir).ok).toBe(true);
  });

  it("falls back to process.cwd() as the only root when REPO_SCAN_ROOTS is unset", () => {
    delete process.env.REPO_SCAN_ROOTS;
    expect(validateSourcePath(process.cwd()).ok).toBe(true);
    expect(validateSourcePath(outsideDir).ok).toBe(false);
  });

  it("still honors the legacy CODE_QUALITY_SCAN_ROOTS env var when REPO_SCAN_ROOTS is unset", () => {
    delete process.env.REPO_SCAN_ROOTS;
    process.env.CODE_QUALITY_SCAN_ROOTS = allowedRoot;
    expect(validateSourcePath(allowedRoot).ok).toBe(true);
    expect(validateSourcePath(outsideDir).ok).toBe(false);
  });

  it("prefers REPO_SCAN_ROOTS over the legacy var when both are set", () => {
    process.env.REPO_SCAN_ROOTS = allowedRoot;
    process.env.CODE_QUALITY_SCAN_ROOTS = outsideDir;
    expect(validateSourcePath(allowedRoot).ok).toBe(true);
    expect(validateSourcePath(outsideDir).ok).toBe(false);
  });
});
