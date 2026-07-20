import type { AnalyzerIssue, AnalyzerResult, ProjectContext } from "./types";
import { extractSnippet } from "./types";
import { readOptionalFile } from "./fsHelpers";

const SENSITIVE_KEY_SUFFIX = /_(PASSWORD|SECRET|KEY|TOKEN)$/i;
const OBVIOUS_DEFAULT_VALUES = new Set(["password", "secret", "changeme", "change-me", "123456", "root", "admin", "your-api-key-here", "your-secret-here", "example", "test"]);

// .env safety: three independent checks, all read directly against .env/.gitignore (see
// fsHelpers.ts - fileWalker.ts can't discover dotfiles via its extname()-based matching).
export async function analyzeDotEnv(ctx: ProjectContext): Promise<AnalyzerResult> {
  const issues: AnalyzerIssue[] = [];

  const envFile = await readOptionalFile(ctx.rootPath, ".env");
  if (!envFile) return { issues };

  // GitHub/GitLab tarball/archive exports never include gitignored files (git archive walks
  // the index, not the working tree) - so a .env file showing up at all in a git-sourced sync
  // is itself proof it's tracked/committed to the repository, not just present on the
  // developer's disk. That inference only holds for git-sourced projects; a Local Path project
  // scans the live filesystem directly, where .env being present is normal regardless of git
  // status.
  if (ctx.isGitSourced) {
    issues.push({
      category: "DotEnv",
      ruleCode: "dotenv.committed",
      title: ".env file is tracked in the repository",
      description: "A .env file was found in a snapshot fetched from the connected GitHub/GitLab repository. Archive exports only include files git actually tracks, so this .env is committed to source control - anyone with repository access can read its secrets.",
      filePath: envFile.relativePath,
      startLine: 1,
      endLine: 1,
      severity: "Critical",
      confidenceLevel: "High",
      recommendation: "Remove .env from the repository (git rm --cached .env), add it to .gitignore, rotate every credential it contained, and commit only .env.example with placeholder values.",
      codeSnippet: undefined,
    });
  }

  const gitignoreFile = await readOptionalFile(ctx.rootPath, ".gitignore");
  const gitignorePatterns = gitignoreFile?.lines.map((l) => l.trim()).filter((l) => l && !l.startsWith("#")) ?? [];
  const envIsIgnored = gitignorePatterns.some((p) => {
    const normalized = p.replace(/^\//, "");
    return normalized === ".env" || normalized === ".env*" || normalized === "*.env" || normalized === ".env.*";
  });
  if (!envIsIgnored) {
    issues.push({
      category: "DotEnv",
      ruleCode: "dotenv.not-gitignored",
      title: ".env is not excluded by .gitignore",
      description: gitignoreFile ? ".gitignore exists but does not exclude .env, so a future commit could accidentally add it and leak every secret it contains." : "No .gitignore was found at the project root, so nothing prevents .env from being committed by accident.",
      filePath: gitignoreFile?.relativePath ?? ".gitignore",
      startLine: 1,
      endLine: 1,
      severity: "High",
      confidenceLevel: "High",
      recommendation: "Add a .env line (or .env*) to .gitignore so the file can never be committed by accident.",
      codeSnippet: undefined,
    });
  }

  envFile.lines.forEach((line, idx) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) return;
    const [, key, rawValue] = match;
    if (!SENSITIVE_KEY_SUFFIX.test(key)) return;
    if (key === "APP_KEY") return; // covered by appKey.ts's own, more specific check
    const value = rawValue.split("#")[0].trim().replace(/^["']|["']$/g, "");
    if (!value) return;
    if (OBVIOUS_DEFAULT_VALUES.has(value.toLowerCase())) {
      issues.push({
        category: "DotEnv",
        ruleCode: "dotenv.sensitive-default",
        title: `${key} looks like a default/example value`,
        description: `${key} is set to "${value}", which matches a common default/example credential. If this environment serves real traffic, treat it as compromised.`,
        filePath: envFile.relativePath,
        startLine: idx + 1,
        endLine: idx + 1,
        codeElement: key,
        severity: "Medium",
        confidenceLevel: "Medium",
        recommendation: `Set ${key} to a unique, randomly generated value for this environment.`,
        codeSnippet: extractSnippet(envFile, idx + 1, idx + 1),
      });
    }
  });

  return { issues };
}
