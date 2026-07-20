import fs from "fs";
import path from "path";
import { describe, it, expect, afterEach } from "vitest";
import { analyzeStorageLinks } from "./storageLinks";
import { makeTempProjectDir, makeContext, makeSourceFile } from "./testHelpers";

const dirs: string[] = [];
function tempDir(files: Record<string, string>): string {
  const dir = makeTempProjectDir(files);
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  while (dirs.length) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe("analyzeStorageLinks", () => {
  it("flags a missing public/storage symlink when storage/app/public exists", async () => {
    const dir = tempDir({ "storage/app/public/.gitkeep": "" });
    const { issues } = await analyzeStorageLinks(makeContext(dir), []);
    expect(issues.some((i) => i.ruleCode === "storagelinks.missing-symlink")).toBe(true);
  });

  it("does not flag when public/storage is a real symlink", async () => {
    const dir = tempDir({ "storage/app/public/.gitkeep": "" });
    fs.mkdirSync(path.join(dir, "public"), { recursive: true });
    fs.symlinkSync(path.join(dir, "storage", "app", "public"), path.join(dir, "public", "storage"), "junction");
    const { issues } = await analyzeStorageLinks(makeContext(dir), []);
    expect(issues.some((i) => i.ruleCode === "storagelinks.missing-symlink")).toBe(false);
  });

  it("does not flag anything when storage/app/public doesn't exist (public disk unused)", async () => {
    const dir = tempDir({});
    const { issues } = await analyzeStorageLinks(makeContext(dir), []);
    expect(issues.some((i) => i.ruleCode === "storagelinks.missing-symlink")).toBe(false);
  });

  it("flags a sensitive-looking path stored on the public disk", async () => {
    const dir = tempDir({});
    const file = makeSourceFile(
      "app/Http/Controllers/InvoiceController.php",
      `<?php\nStorage::disk('public')->put('invoices/' . $id . '.pdf', $contents);\n`
    );
    const { issues } = await analyzeStorageLinks(makeContext(dir), [file]);
    expect(issues.some((i) => i.ruleCode === "storagelinks.public-disk-sensitive")).toBe(true);
  });

  it("does not flag an ordinary public disk path", async () => {
    const dir = tempDir({});
    const file = makeSourceFile("app/Http/Controllers/AvatarController.php", `<?php\nStorage::disk('public')->put('avatars/' . $id . '.png', $contents);\n`);
    const { issues } = await analyzeStorageLinks(makeContext(dir), [file]);
    expect(issues.some((i) => i.ruleCode === "storagelinks.public-disk-sensitive")).toBe(false);
  });
});
