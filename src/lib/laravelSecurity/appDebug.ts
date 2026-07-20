import type { AnalyzerIssue, AnalyzerResult, ProjectContext } from "./types";
import { extractSnippet } from "./types";
import { readOptionalFile } from "./fsHelpers";

const TRUTHY = new Set(["true", "1", "yes", "(true)"]);

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

// APP_DEBUG=true (or any env file that doesn't explicitly set it to false) makes Laravel's
// Whoops error handler render full stack traces, file paths, and - critically - the resolved
// .env values themselves on any unhandled exception. Checked directly against .env (see
// fsHelpers.ts's readOptionalFile - fileWalker.ts can't discover dotfiles) rather than via the
// generic file walk.
export async function analyzeAppDebug(ctx: ProjectContext): Promise<AnalyzerResult> {
  const issues: AnalyzerIssue[] = [];

  const envFile = await readOptionalFile(ctx.rootPath, ".env");
  if (envFile) {
    const lineIdx = envFile.lines.findIndex((l) => /^\s*APP_DEBUG\s*=/.test(l));
    if (lineIdx !== -1) {
      const match = envFile.lines[lineIdx].match(/^\s*APP_DEBUG\s*=\s*(.*)$/);
      const rawValue = stripQuotes((match?.[1] ?? "").split("#")[0].trim());
      if (TRUTHY.has(rawValue.toLowerCase())) {
        issues.push({
          category: "AppDebug",
          ruleCode: "appdebug.enabled-in-env",
          title: "APP_DEBUG is enabled",
          description: "APP_DEBUG is set to a truthy value in .env. When enabled, Laravel's debug error pages expose full stack traces, file paths, environment variables, and query bindings to anyone who triggers an unhandled exception.",
          filePath: envFile.relativePath,
          startLine: lineIdx + 1,
          endLine: lineIdx + 1,
          codeElement: "APP_DEBUG",
          severity: "Critical",
          confidenceLevel: "High",
          recommendation: "Set APP_DEBUG=false in every environment that serves real traffic. Keep it true only in local development.",
          codeSnippet: extractSnippet(envFile, lineIdx + 1, lineIdx + 1),
        });
      }
    }
  }

  const configFile = await readOptionalFile(ctx.rootPath, "config/app.php");
  if (configFile) {
    const lineIdx = configFile.lines.findIndex((l) => /['"]debug['"]\s*=>/.test(l));
    if (lineIdx !== -1) {
      const line = configFile.lines[lineIdx];
      const hardcodedTrue = /['"]debug['"]\s*=>\s*(\(bool\)\s*)?true\s*,?/.test(line) && !/env\s*\(/.test(line);
      if (hardcodedTrue) {
        issues.push({
          category: "AppDebug",
          ruleCode: "appdebug.enabled-in-config",
          title: "config/app.php hardcodes debug to true",
          description: "The 'debug' key in config/app.php is hardcoded to true instead of reading from env('APP_DEBUG', false), so APP_DEBUG in .env can no longer turn it off.",
          filePath: configFile.relativePath,
          startLine: lineIdx + 1,
          endLine: lineIdx + 1,
          codeElement: "debug",
          severity: "High",
          confidenceLevel: "High",
          recommendation: "Restore Laravel's default: 'debug' => (bool) env('APP_DEBUG', false).",
          codeSnippet: extractSnippet(configFile, lineIdx + 1, lineIdx + 1),
        });
      }
    }
  }

  return { issues };
}
