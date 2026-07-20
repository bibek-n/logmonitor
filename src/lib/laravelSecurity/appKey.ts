import type { AnalyzerIssue, AnalyzerResult, ProjectContext } from "./types";
import { extractSnippet } from "./types";
import { readOptionalFile } from "./fsHelpers";

const VALID_KEY = /^base64:[A-Za-z0-9+/]+=*$/;
const KNOWN_PLACEHOLDERS = new Set([
  "somerandomstring",
  "base64:someapplicationkey",
  "changeme",
  "your-secret-key-here",
  "your-app-key-here",
  "base64:generateyourownkey",
]);

// APP_KEY is Laravel's master encryption key - it underlies session/cookie encryption,
// Crypt::encrypt(), and signed URLs. A missing, empty, or well-known-placeholder key means
// every one of those is either broken or trivially forgeable by anyone who knows the
// placeholder value (several appear verbatim in public tutorials/boilerplate repos).
export async function analyzeAppKey(ctx: ProjectContext): Promise<AnalyzerResult> {
  const issues: AnalyzerIssue[] = [];

  const envFile = await readOptionalFile(ctx.rootPath, ".env");
  if (!envFile) return { issues };

  const lineIdx = envFile.lines.findIndex((l) => /^\s*APP_KEY\s*=/.test(l));
  if (lineIdx === -1) return { issues };

  const match = envFile.lines[lineIdx].match(/^\s*APP_KEY\s*=\s*(.*)$/);
  const rawValue = (match?.[1] ?? "").split("#")[0].trim().replace(/^["']|["']$/g, "");

  if (!rawValue) {
    issues.push({
      category: "AppKey",
      ruleCode: "appkey.missing",
      title: "APP_KEY is empty",
      description: "APP_KEY is present in .env but has no value. Laravel cannot securely encrypt sessions, cookies, or Crypt::encrypt() payloads without it, and will refuse to boot in some configurations.",
      filePath: envFile.relativePath,
      startLine: lineIdx + 1,
      endLine: lineIdx + 1,
      codeElement: "APP_KEY",
      severity: "Critical",
      confidenceLevel: "High",
      recommendation: "Generate a real key with `php artisan key:generate`.",
      codeSnippet: extractSnippet(envFile, lineIdx + 1, lineIdx + 1),
    });
    return { issues };
  }

  const looksPlaceholder = KNOWN_PLACEHOLDERS.has(rawValue.toLowerCase());
  const looksValid = VALID_KEY.test(rawValue) && rawValue.length > "base64:".length + 20;

  if (looksPlaceholder || !looksValid) {
    issues.push({
      category: "AppKey",
      ruleCode: "appkey.weak-or-default",
      title: "APP_KEY looks weak, default, or placeholder",
      description: "APP_KEY does not match Laravel's base64:<32-byte-key> format produced by `php artisan key:generate`, or matches a well-known placeholder value seen in public tutorials/boilerplate.",
      filePath: envFile.relativePath,
      startLine: lineIdx + 1,
      endLine: lineIdx + 1,
      codeElement: "APP_KEY",
      severity: "Critical",
      confidenceLevel: looksPlaceholder ? "High" : "Medium",
      recommendation: "Generate a fresh key with `php artisan key:generate` and re-encrypt any data (e.g. existing sessions, encrypted DB columns) that depended on the old key.",
      codeSnippet: extractSnippet(envFile, lineIdx + 1, lineIdx + 1),
    });
  }

  return { issues };
}
