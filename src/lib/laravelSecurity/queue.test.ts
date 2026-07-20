import fs from "fs";
import { describe, it, expect, afterEach } from "vitest";
import { analyzeQueue } from "./queue";
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

describe("analyzeQueue", () => {
  it("flags QUEUE_CONNECTION=sync", async () => {
    const dir = tempDir({ ".env": "QUEUE_CONNECTION=sync\n" });
    const { issues } = await analyzeQueue(makeContext(dir), []);
    expect(issues.some((i) => i.ruleCode === "queue.sync-driver-in-production")).toBe(true);
  });

  it("does not flag a real queue driver", async () => {
    const dir = tempDir({ ".env": "QUEUE_CONNECTION=redis\n" });
    const { issues } = await analyzeQueue(makeContext(dir), []);
    expect(issues.some((i) => i.ruleCode === "queue.sync-driver-in-production")).toBe(false);
  });

  it("flags a sensitive ShouldQueue job with no failed() handler", async () => {
    const dir = tempDir({});
    const file = makeSourceFile(
      "app/Jobs/ChargeCustomer.php",
      `<?php\nclass ChargeCustomer implements ShouldQueue {\n  public function handle() {\n    Stripe::charge($this->amount);\n  }\n}\n`
    );
    const { issues } = await analyzeQueue(makeContext(dir), [file]);
    expect(issues.some((i) => i.ruleCode === "queue.job-missing-failed-handling")).toBe(true);
  });

  it("does not flag a job that defines failed()", async () => {
    const dir = tempDir({});
    const file = makeSourceFile(
      "app/Jobs/ChargeCustomer.php",
      `<?php\nclass ChargeCustomer implements ShouldQueue {\n  public function handle() {\n    Stripe::charge($this->amount);\n  }\n  public function failed(Throwable $e) {\n    Log::error($e);\n  }\n}\n`
    );
    const { issues } = await analyzeQueue(makeContext(dir), [file]);
    expect(issues.some((i) => i.ruleCode === "queue.job-missing-failed-handling")).toBe(false);
  });

  it("does not flag a non-sensitive job", async () => {
    const dir = tempDir({});
    const file = makeSourceFile("app/Jobs/RecalculateStats.php", `<?php\nclass RecalculateStats implements ShouldQueue {\n  public function handle() {\n    Stats::recalculate();\n  }\n}\n`);
    const { issues } = await analyzeQueue(makeContext(dir), [file]);
    expect(issues.some((i) => i.ruleCode === "queue.job-missing-failed-handling")).toBe(false);
  });
});
