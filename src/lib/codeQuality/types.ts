export type IssueCategory = "Complexity" | "Duplication" | "DeadCode" | "UnusedVariable" | "UnusedFunction" | "CodingStandard";
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

export interface AnalyzerMetric {
  metricType: string;
  metricName: string;
  value: number;
  threshold?: number;
  additionalData?: Record<string, unknown>;
}

export interface SourceFile {
  absolutePath: string;
  relativePath: string;
  content: string;
  lines: string[];
}

// Resolved, effective settings for one scan - a merge of CodeQualitySettings (global
// defaults) with a project's own ScanConfig JSON override, if any. Analyzers only ever see
// this shape, never the raw DB rows, so a new analyzer never needs to know where a threshold
// came from.
export interface EffectiveScanSettings {
  complexityLowMax: number;
  complexityMediumMax: number;
  complexityHighMax: number;
  duplicationThresholdPercent: number;
  minDuplicateBlockSize: number;
  maxLineLength: number;
  excludedDirectories: string[];
  allowedExtensions: string[];
  maxScanSizeMb: number;
  weights: {
    complexity: number;
    duplication: number;
    deadCode: number;
    unusedVariables: number;
    unusedFunctions: number;
    codingStandards: number;
  };
  scales: {
    complexity: number;
    duplication: number;
    deadCode: number;
    unusedVariables: number;
    unusedFunctions: number;
    codingStandards: number;
  };
  enabledRuleCodes: Set<string>;
}

export interface AnalyzerResult {
  issues: AnalyzerIssue[];
  metrics: AnalyzerMetric[];
}

// Shared helper: pulls a snippet of `context` lines before/after the target range, capped
// so a huge function body never ends up fully embedded in an issue row - the security
// requirement is "show only the relevant lines," not the whole file.
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
