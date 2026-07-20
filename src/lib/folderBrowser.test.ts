import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { browseFolder } from "./folderBrowser";

describe("browseFolder", () => {
  let root: string;
  const previousRoots = process.env.CODE_QUALITY_SCAN_ROOTS;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "cq-browse-"));
    fs.mkdirSync(path.join(root, "src"));
    fs.mkdirSync(path.join(root, "src", "lib"));
    fs.mkdirSync(path.join(root, "node_modules")); // should be hidden from listings
    fs.mkdirSync(path.join(root, ".git")); // should be hidden (dotfile)
    fs.writeFileSync(path.join(root, "README.md"), "not a directory"); // must not appear as an entry
    process.env.CODE_QUALITY_SCAN_ROOTS = root;
  });

  afterEach(() => {
    if (previousRoots === undefined) delete process.env.CODE_QUALITY_SCAN_ROOTS;
    else process.env.CODE_QUALITY_SCAN_ROOTS = previousRoots;
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("lists the configured allowed roots when no path is given", () => {
    const result = browseFolder(null);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.currentPath).toBe(null);
    expect(result.data.parentPath).toBe(null);
    expect(result.data.entries.map((e) => e.path)).toContain(fs.realpathSync(root));
  });

  it("lists real subdirectories of an allowed root, excluding files, node_modules, and dotfiles", () => {
    const result = browseFolder(root);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const names = result.data.entries.map((e) => e.name);
    expect(names).toEqual(["src"]);
  });

  it("navigates into a subdirectory and reports its parent", () => {
    const srcPath = path.join(root, "src");
    const result = browseFolder(srcPath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.entries.map((e) => e.name)).toEqual(["lib"]);
    expect(result.data.parentPath).toBe(fs.realpathSync(root));
  });

  it("reports parentPath=null when already at the root (can't navigate above it)", () => {
    const result = browseFolder(root);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.parentPath).toBe(null);
  });

  it("rejects a path outside every configured root", () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "cq-browse-outside-"));
    try {
      const result = browseFolder(outside);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toContain("outside the approved scan roots");
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it("rejects a path that does not exist", () => {
    const result = browseFolder(path.join(root, "does-not-exist"));
    expect(result.ok).toBe(false);
  });

  it("rejects a path that points to a file, not a directory", () => {
    const result = browseFolder(path.join(root, "README.md"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("not a directory");
  });

  it("returns an empty entries list for a leaf directory with no subdirectories", () => {
    const result = browseFolder(path.join(root, "src", "lib"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.entries).toEqual([]);
  });
});
