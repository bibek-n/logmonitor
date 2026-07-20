import type { AnalyzerIssue, EffectiveScanSettings, IssueCategory } from "./types";

export interface SecurityScoreBreakdown {
  overall: number; // 0-100, clamped
  categories: Record<IssueCategory, number>;
}

const CATEGORIES: IssueCategory[] = ["AppDebug", "AppKey", "DotEnv", "Csrf", "MassAssignment", "Validation", "Sanitization", "StorageLinks", "Queue"];

const WEIGHT_KEY: Record<IssueCategory, keyof EffectiveScanSettings["weights"]> = {
  AppDebug: "appDebug",
  AppKey: "appKey",
  DotEnv: "dotEnv",
  Csrf: "csrf",
  MassAssignment: "massAssignment",
  Validation: "validation",
  Sanitization: "sanitization",
  StorageLinks: "storageLinks",
  Queue: "queue",
};

const SEVERITY_KEY: Record<AnalyzerIssue["severity"], keyof EffectiveScanSettings["pointsPerSeverity"]> = {
  Low: "low",
  Medium: "medium",
  High: "high",
  Critical: "critical",
};

// Documented formula (mirrors codeQuality/qualityScore.ts's own doc-comment convention):
//
//   Score = clamp(0, 100, Σ CategoryScore_i × Weight_i ÷ ΣWeight_i)
//   CategoryScore_i = 100 − min(100, Σ pointsPerSeverity(issue) for issues in category i)
//
// Unlike Code Quality's KLOC-normalized density formula, these checks are mostly
// presence/absence findings (an exposed APP_KEY is exactly as bad in a 500-line project as a
// 50,000-line one), so points are summed per category with no size normalization. Every
// weight/points value is read from LaravelSecuritySettings (via EffectiveScanSettings), never
// hard-coded, so an administrator can retune the formula without a code change.
export function calculateSecurityScore(issues: AnalyzerIssue[], settings: EffectiveScanSettings): SecurityScoreBreakdown {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));

  const categories = {} as Record<IssueCategory, number>;
  for (const category of CATEGORIES) {
    const penalty = issues
      .filter((i) => i.category === category)
      .reduce((sum, i) => sum + settings.pointsPerSeverity[SEVERITY_KEY[i.severity]], 0);
    categories[category] = Math.round(clamp(100 - Math.min(100, penalty)));
  }

  const totalWeight = CATEGORIES.reduce((sum, c) => sum + settings.weights[WEIGHT_KEY[c]], 0);
  const safeTotalWeight = totalWeight > 0 ? totalWeight : 1;

  const overall = clamp(CATEGORIES.reduce((sum, c) => sum + categories[c] * settings.weights[WEIGHT_KEY[c]], 0) / safeTotalWeight);

  return { overall: Math.round(overall), categories };
}
