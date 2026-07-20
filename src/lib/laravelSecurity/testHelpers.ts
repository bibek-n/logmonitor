import fs from "fs";
import os from "os";
import path from "path";
import type { EffectiveScanSettings, ProjectContext, SourceFile } from "./types";

export function makeSourceFile(relativePath: string, content: string): SourceFile {
  return {
    absolutePath: `/repo/${relativePath}`,
    relativePath,
    content,
    lines: content.split(/\r\n|\r|\n/),
  };
}

// Mirrors the seeded LaravelSecuritySettings defaults from migrate-laravel-security.ts.
export function makeSettings(overrides: Partial<EffectiveScanSettings> = {}): EffectiveScanSettings {
  return {
    excludedDirectories: ["vendor", "node_modules", ".git", "storage/framework", "storage/logs", "bootstrap/cache"],
    allowedExtensions: [".php"],
    maxScanSizeMb: 500,
    weights: { appDebug: 15, appKey: 15, dotEnv: 15, csrf: 15, massAssignment: 10, validation: 10, sanitization: 10, storageLinks: 5, queue: 5 },
    pointsPerSeverity: { low: 2, medium: 5, high: 10, critical: 20 },
    enabledRuleCodes: new Set([
      "appdebug.enabled-in-env",
      "appdebug.enabled-in-config",
      "appkey.missing",
      "appkey.weak-or-default",
      "dotenv.committed",
      "dotenv.not-gitignored",
      "dotenv.sensitive-default",
      "csrf.missing-token-in-form",
      "csrf.route-excluded",
      "massassignment.guarded-empty",
      "massassignment.fillable-missing",
      "massassignment.request-all",
      "validation.controller-missing",
      "validation.route-param-unvalidated",
      "sanitization.raw-blade-echo",
      "sanitization.raw-html-helper",
      "storagelinks.missing-symlink",
      "storagelinks.public-disk-sensitive",
      "queue.sync-driver-in-production",
      "queue.job-missing-failed-handling",
    ]),
    ...overrides,
  };
}

// Real temp-dir fixtures for the analyzers that read the project root directly (appDebug/
// appKey/dotenv/storageLinks/queue) - same fs.mkdtempSync/os.tmpdir() pattern established by
// folderBrowser.test.ts, since these analyzers do real fs.readFile/fs.lstat calls that a fake
// SourceFile can't stand in for.
export function makeTempProjectDir(files: Record<string, string> = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ls-test-"));
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(dir, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, "utf8");
  }
  return dir;
}

export function makeContext(rootPath: string, isGitSourced = false): ProjectContext {
  return { rootPath, isGitSourced };
}
