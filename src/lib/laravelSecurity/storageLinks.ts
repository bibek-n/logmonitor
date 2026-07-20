import fs from "fs/promises";
import path from "path";
import type { AnalyzerIssue, AnalyzerResult, ProjectContext, SourceFile } from "./types";
import { extractSnippet } from "./types";
import { pathExists } from "./fsHelpers";

const SENSITIVE_PATH_WORDS = /private|invoice|ssn|passport|contract|salary|medical|tax|payroll|confidential/i;
const PUBLIC_DISK_PUT = /Storage::disk\(\s*['"]public['"]\s*\)\s*->\s*(put|putFile|putFileAs)\s*\(([^)]*)\)/g;

// storagelinks.missing-symlink checks the filesystem directly (a symlink is a filesystem
// property, not something visible in source); storagelinks.public-disk-sensitive walks
// already-read .php files looking for Storage::disk('public') calls whose path argument
// suggests sensitive content.
export async function analyzeStorageLinks(ctx: ProjectContext, files: SourceFile[]): Promise<AnalyzerResult> {
  const issues: AnalyzerIssue[] = [];

  const storageAppPublicExists = await pathExists(path.join(ctx.rootPath, "storage", "app", "public"));
  if (storageAppPublicExists) {
    const publicStoragePath = path.join(ctx.rootPath, "public", "storage");
    let isSymlink = false;
    try {
      const stat = await fs.lstat(publicStoragePath);
      isSymlink = stat.isSymbolicLink();
    } catch {
      isSymlink = false;
    }
    if (!isSymlink) {
      issues.push({
        category: "StorageLinks",
        ruleCode: "storagelinks.missing-symlink",
        title: "public/storage symlink is missing",
        description: "storage/app/public exists (the app uses Laravel's 'public' disk) but public/storage does not exist as a symlink. Storage::url() will return paths that 404 in the browser, and some deployments work around this by copying files instead - which then silently drifts out of sync with storage/app/public.",
        filePath: "public/storage",
        startLine: 1,
        endLine: 1,
        severity: "Medium",
        confidenceLevel: "High",
        recommendation: "Run `php artisan storage:link` during deployment to create the symlink.",
        codeSnippet: undefined,
      });
    }
  }

  for (const file of files) {
    const regex = new RegExp(PUBLIC_DISK_PUT.source, "g");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(file.content)) !== null) {
      const args = match[2];
      if (!SENSITIVE_PATH_WORDS.test(args)) continue;
      const lineIdx = file.content.slice(0, match.index).split("\n").length - 1;
      issues.push({
        category: "StorageLinks",
        ruleCode: "storagelinks.public-disk-sensitive",
        title: "Sensitive-looking path stored on the public disk",
        description: `Storage::disk('public')->${match[1]}(${args.slice(0, 100)}) stores a file under a path suggesting sensitive content. Anything on the 'public' disk is served through public/storage with no authorization check - only what's meant to be publicly downloadable by anyone with the URL should live there.`,
        filePath: file.relativePath,
        startLine: lineIdx + 1,
        endLine: lineIdx + 1,
        severity: "Medium",
        confidenceLevel: "Low",
        recommendation: "Store sensitive files on a private disk (e.g. 'local') and serve them through an authenticated route that streams the file after checking the requesting user's permission.",
        codeSnippet: extractSnippet(file, lineIdx + 1, lineIdx + 1),
      });
    }
  }

  return { issues };
}
