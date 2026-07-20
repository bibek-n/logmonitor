import fs from "fs";
import { describe, it, expect, afterEach } from "vitest";
import { analyzeAppDebug } from "./appDebug";
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

describe("analyzeAppDebug", () => {
  it("flags APP_DEBUG=true in .env", async () => {
    const dir = tempDir({ ".env": "APP_NAME=Test\nAPP_DEBUG=true\nAPP_KEY=base64:abc\n" });
    const { issues } = await analyzeAppDebug(makeContext(dir));
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleCode).toBe("appdebug.enabled-in-env");
    expect(issues[0].severity).toBe("Critical");
  });

  it("does not flag APP_DEBUG=false", async () => {
    const dir = tempDir({ ".env": "APP_DEBUG=false\n" });
    const { issues } = await analyzeAppDebug(makeContext(dir));
    expect(issues).toHaveLength(0);
  });

  it("does nothing when there is no .env at all", async () => {
    const dir = tempDir({});
    const { issues } = await analyzeAppDebug(makeContext(dir));
    expect(issues).toHaveLength(0);
  });

  it("flags config/app.php hardcoding debug to true", async () => {
    const dir = tempDir({ "config/app.php": "<?php\nreturn [\n  'debug' => true,\n];\n" });
    const { issues } = await analyzeAppDebug(makeContext(dir));
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleCode).toBe("appdebug.enabled-in-config");
  });

  it("does not flag config/app.php using env('APP_DEBUG', false)", async () => {
    const dir = tempDir({ "config/app.php": "<?php\nreturn [\n  'debug' => (bool) env('APP_DEBUG', false),\n];\n" });
    const { issues } = await analyzeAppDebug(makeContext(dir));
    expect(issues).toHaveLength(0);
  });
});
