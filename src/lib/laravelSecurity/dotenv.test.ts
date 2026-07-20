import fs from "fs";
import { describe, it, expect, afterEach } from "vitest";
import { analyzeDotEnv } from "./dotenv";
import { makeTempProjectDir, makeContext } from "./testHelpers";

const dirs: string[] = [];
function tempDir(files: Record<string, string>): string {
  const dir = makeTempProjectDir(files);
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  while (dirs.length) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe("analyzeDotEnv", () => {
  it("does nothing when there is no .env at all", async () => {
    const dir = tempDir({});
    const { issues } = await analyzeDotEnv(makeContext(dir));
    expect(issues).toHaveLength(0);
  });

  it("flags a .env found in a git-sourced snapshot as committed", async () => {
    const dir = tempDir({ ".env": "APP_NAME=Test\n", ".gitignore": ".env\n" });
    const { issues } = await analyzeDotEnv(makeContext(dir, true));
    expect(issues.some((i) => i.ruleCode === "dotenv.committed")).toBe(true);
  });

  it("does not flag dotenv.committed for a Local Path project", async () => {
    const dir = tempDir({ ".env": "APP_NAME=Test\n", ".gitignore": ".env\n" });
    const { issues } = await analyzeDotEnv(makeContext(dir, false));
    expect(issues.some((i) => i.ruleCode === "dotenv.committed")).toBe(false);
  });

  it("flags a missing .gitignore exclusion", async () => {
    const dir = tempDir({ ".env": "APP_NAME=Test\n" });
    const { issues } = await analyzeDotEnv(makeContext(dir));
    expect(issues.some((i) => i.ruleCode === "dotenv.not-gitignored")).toBe(true);
  });

  it("does not flag when .gitignore excludes .env", async () => {
    const dir = tempDir({ ".env": "APP_NAME=Test\n", ".gitignore": "/vendor\n.env\n" });
    const { issues } = await analyzeDotEnv(makeContext(dir));
    expect(issues.some((i) => i.ruleCode === "dotenv.not-gitignored")).toBe(false);
  });

  it("flags an obvious default credential", async () => {
    const dir = tempDir({ ".env": "DB_PASSWORD=password\n", ".gitignore": ".env\n" });
    const { issues } = await analyzeDotEnv(makeContext(dir));
    expect(issues.some((i) => i.ruleCode === "dotenv.sensitive-default")).toBe(true);
  });

  it("does not flag a non-default credential", async () => {
    const dir = tempDir({ ".env": "DB_PASSWORD=xK9#mP2$vL8qR\n", ".gitignore": ".env\n" });
    const { issues } = await analyzeDotEnv(makeContext(dir));
    expect(issues.some((i) => i.ruleCode === "dotenv.sensitive-default")).toBe(false);
  });
});
