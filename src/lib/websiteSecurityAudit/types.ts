export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type RiskLevel = "Critical" | "High" | "Medium" | "Low";
export type Confidence = "Confirmed" | "Firm" | "Tentative";

// Which of the 10 report sub-scores a finding counts against — drives both scoring.ts's
// per-module buckets and the PDF's module-breakdown section.
export type ScoreModule = "headers" | "ssl" | "auth" | "cookies" | "js" | "dns" | "email" | "server" | "owasp" | "performance";

// Shared enterprise-report fields every finding kind carries once merged with
// findingCatalog.ts metadata in runScan.ts — all optional so existing v1 findings/tests
// that don't set them keep working unchanged.
export interface EnterpriseFindingFields {
  cvss?: number;
  cwe?: string;
  owaspCategory?: string;
  confidence?: Confidence;
  affectedUrl?: string;
  parameter?: string;
  httpMethod?: string;
  module?: ScoreModule;
  httpRequestSnippet?: string;
  httpResponseSnippet?: string;
  businessImpact?: string;
  attackScenario?: string;
  verificationSteps?: string;
  references?: string[];
}

export interface Finding extends EnterpriseFindingFields {
  category: string;
  severity: Severity;
  title: string;
  description?: string;
  evidence?: string;
  recommendation?: string;
}

export interface DependencyFinding extends EnterpriseFindingFields {
  packageName: string;
  currentVersion: string | null;
  recommendedVersion: string | null;
  ecosystem: string;
  severity: Severity;
  cveIds: string | null;
  reason: string;
}

export interface CodeFinding extends EnterpriseFindingFields {
  category: string;
  severity: Severity;
  location: string | null;
  maskedEvidence: string;
  recommendation: string;
}

export interface PreviousScanSummary {
  scanDate: string;
  securityScore: number;
  riskLevel: RiskLevel;
}

export interface ScanResult {
  detectedPlatform: string;
  findings: Finding[];
  dependencyFindings: DependencyFinding[];
  codeFindings: CodeFinding[];
  securityScore: number;
  riskLevel: RiskLevel;
  recommendations: string[];
}

export const SUPPORTED_PLATFORMS = [
  "Next.js",
  "React",
  "Node.js",
  "Laravel",
  "PHP",
  "ASP.NET",
  ".NET Core",
  "WordPress",
  "Python",
  "Django",
  "Flask",
  "Java",
  "Spring Boot",
  "Ruby on Rails",
  "Vue.js",
  "Angular",
  "Other",
] as const;
