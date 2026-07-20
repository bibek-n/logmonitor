export type IssueCategory = "AppDebug" | "AppKey" | "DotEnv" | "Csrf" | "MassAssignment" | "Validation" | "Sanitization" | "StorageLinks" | "Queue";
export type IssueSeverity = "Low" | "Medium" | "High" | "Critical";
export type ConfidenceLevel = "Low" | "Medium" | "High";

export interface AnalyzerIssue {
  category: IssueCategory;
  ruleCode: string;
  title: string;
  description: string;
  filePath: string; // relative to the project's source root
  startLine: number;
  endLine: number;
  codeElement?: string;
  severity: IssueSeverity;
  confidenceLevel?: ConfidenceLevel;
  recommendation?: string;
  codeSnippet?: string;
}

export interface AnalyzerResult {
  issues: AnalyzerIssue[];
}

export interface SourceFile {
  absolutePath: string;
  relativePath: string;
  content: string;
  lines: string[];
}

// Passed to analyzers that need direct, targeted access to the project root (root-relative
// dotfiles/config, symlink checks) rather than the walked file list - see fsHelpers.ts's
// readOptionalFile() for why these can't just be picked up via fileWalker.ts.
export interface ProjectContext {
  rootPath: string;
  // True when this scan's SourcePath is a fresh sync from a GitHub/GitLab connection (see
  // RepoConnections) rather than a Local Path project. GitHub/GitLab archive/tarball exports
  // never include gitignored files, so finding a .env file at all in a git-sourced snapshot is
  // itself strong evidence it's tracked/committed - that inference isn't valid for a Local
  // Path project, where .env simply being present on disk (gitignored or not) is normal.
  isGitSourced: boolean;
}

// Resolved, effective settings for one scan - a merge of LaravelSecuritySettings (global
// defaults) with a project's own ScanConfig JSON override, if any. Analyzers only ever see
// this shape, never the raw DB rows. Mirrors codeQuality/types.ts's EffectiveScanSettings, but
// weights are per-check-category (not per-metric) and there's a single pointsPerSeverity scale
// shared across categories instead of CQ's per-category "scale" - these checks are mostly
// presence/absence findings, not density metrics, so one issue of a given severity costs the
// same regardless of which of the 9 categories it's in.
export interface EffectiveScanSettings {
  excludedDirectories: string[];
  allowedExtensions: string[];
  maxScanSizeMb: number;
  weights: {
    appDebug: number;
    appKey: number;
    dotEnv: number;
    csrf: number;
    massAssignment: number;
    validation: number;
    sanitization: number;
    storageLinks: number;
    queue: number;
  };
  pointsPerSeverity: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  enabledRuleCodes: Set<string>;
}

// Shared helper: pulls a snippet of `context` lines before/after the target range, capped
// so a huge file's content never ends up fully embedded in an issue row. Identical logic to
// codeQuality/types.ts's extractSnippet - duplicated rather than imported so this module stays
// self-contained (no cross-module coupling, matching this app's precedent of each scan module
// owning its own small generic helpers rather than sharing them).
export function extractSnippet(file: SourceFile, startLine: number, endLine: number, context = 2, maxLines = 20): string {
  const from = Math.max(1, startLine - context);
  const to = Math.min(file.lines.length, Math.min(endLine + context, startLine + maxLines));
  const width = String(to).length;
  const out: string[] = [];
  for (let lineNo = from; lineNo <= to; lineNo++) {
    const text = file.lines[lineNo - 1] ?? "";
    out.push(`${String(lineNo).padStart(width, " ")} | ${text}`);
  }
  return out.join("\n");
}
