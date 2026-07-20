import type { CodeFinding, DependencyFinding, Finding, RiskLevel, ScoreModule, Severity } from "./types";

// Same deduct-from-100 shape as computeHealthScore() in endpoint-agents/page.tsx, just
// weighted by finding severity instead of raw metric thresholds.
const SEVERITY_DEDUCTION: Record<Severity, number> = {
  critical: 20,
  high: 12,
  medium: 6,
  low: 2,
  info: 0,
};

export function computeSecurityScore(findings: Finding[], dependencyFindings: DependencyFinding[], codeFindings: CodeFinding[]): number {
  let score = 100;
  for (const f of findings) score -= SEVERITY_DEDUCTION[f.severity];
  for (const f of dependencyFindings) score -= SEVERITY_DEDUCTION[f.severity];
  for (const f of codeFindings) score -= SEVERITY_DEDUCTION[f.severity];
  return Math.max(0, Math.round(score));
}

export function riskLevelForScore(score: number): RiskLevel {
  if (score < 40) return "Critical";
  if (score < 60) return "High";
  if (score < 80) return "Medium";
  return "Low";
}

export function buildRecommendations(findings: Finding[], dependencyFindings: DependencyFinding[], codeFindings: CodeFinding[]): string[] {
  const recs = new Set<string>();
  for (const f of [...findings, ...codeFindings]) {
    if (f.recommendation) recs.add(f.recommendation);
  }
  if (dependencyFindings.some((f) => f.reason === "known_cve")) {
    recs.add("Upgrade dependencies with known CVEs to a patched version as soon as possible.");
  }
  if (dependencyFindings.some((f) => f.reason === "deprecated_or_abandoned")) {
    recs.add("Replace deprecated/abandoned packages with actively maintained alternatives.");
  }
  return [...recs];
}

const ALL_MODULES: ScoreModule[] = ["headers", "ssl", "auth", "cookies", "js", "dns", "email", "server", "owasp", "performance"];

export type ModuleScores = Record<ScoreModule, number>;

// Same deduct-from-100 style as computeSecurityScore(), just scoped to findings tagged with
// each module — gives the report's per-section score breakdown (Section 18) without a
// separate scoring engine per module.
export function computeModuleScores(findings: Finding[], dependencyFindings: DependencyFinding[], codeFindings: CodeFinding[]): ModuleScores {
  const all: { module?: ScoreModule; severity: Severity }[] = [...findings, ...dependencyFindings, ...codeFindings];
  const scores = {} as ModuleScores;
  for (const module of ALL_MODULES) {
    let score = 100;
    for (const f of all) {
      if (f.module === module) score -= SEVERITY_DEDUCTION[f.severity];
    }
    scores[module] = Math.max(0, Math.round(score));
  }
  return scores;
}

export interface RemediationRoadmap {
  immediate: string[];
  within7Days: string[];
  within30Days: string[];
  bestPractice: string[];
  informational: string[];
}

function bucketKeyFor(severity: Severity): keyof RemediationRoadmap {
  switch (severity) {
    case "critical":
      return "immediate";
    case "high":
      return "within7Days";
    case "medium":
      return "within30Days";
    case "low":
      return "bestPractice";
    default:
      return "informational";
  }
}

// Section 20 — buckets every actionable recommendation by severity-implied timeframe.
export function buildRemediationRoadmap(findings: Finding[], dependencyFindings: DependencyFinding[], codeFindings: CodeFinding[]): RemediationRoadmap {
  const roadmap: RemediationRoadmap = { immediate: [], within7Days: [], within30Days: [], bestPractice: [], informational: [] };

  for (const f of [...findings, ...codeFindings]) {
    if (f.recommendation) roadmap[bucketKeyFor(f.severity)].push(f.recommendation);
  }
  for (const f of dependencyFindings) {
    const rec = f.reason === "known_cve" ? `Upgrade ${f.packageName} (known CVEs: ${f.cveIds}).` : `Replace deprecated/unmaintained package ${f.packageName}.`;
    roadmap[bucketKeyFor(f.severity)].push(rec);
  }

  for (const key of Object.keys(roadmap) as (keyof RemediationRoadmap)[]) {
    roadmap[key] = [...new Set(roadmap[key])];
  }
  return roadmap;
}
