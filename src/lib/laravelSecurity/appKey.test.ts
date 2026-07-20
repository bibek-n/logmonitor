import fs from "fs";
import { describe, it, expect, afterEach } from "vitest";
import { analyzeAppKey } from "./appKey";
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

describe("analyzeAppKey", () => {
  it("flags an empty APP_KEY", async () => {
    const dir = tempDir({ ".env": "APP_KEY=\n" });
    const { issues } = await analyzeAppKey(makeContext(dir));
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleCode).toBe("appkey.missing");
  });

  it("flags a well-known placeholder APP_KEY", async () => {
    const dir = tempDir({ ".env": "APP_KEY=SomeRandomString\n" });
    const { issues } = await analyzeAppKey(makeContext(dir));
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleCode).toBe("appkey.weak-or-default");
    expect(issues[0].confidenceLevel).toBe("High");
  });

  it("flags a key that doesn't match the base64: format", async () => {
    const dir = tempDir({ ".env": "APP_KEY=not-a-real-key\n" });
    const { issues } = await analyzeAppKey(makeContext(dir));
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleCode).toBe("appkey.weak-or-default");
  });

  it("does not flag a real generated key", async () => {
    const dir = tempDir({ ".env": "APP_KEY=base64:XyOEXAMPLE1234567890abcdefghijklmnopqrstuv==\n" });
    const { issues } = await analyzeAppKey(makeContext(dir));
    expect(issues).toHaveLength(0);
  });

  it("does nothing when there is no .env at all", async () => {
    const dir = tempDir({});
    const { issues } = await analyzeAppKey(makeContext(dir));
    expect(issues).toHaveLength(0);
  });
});
