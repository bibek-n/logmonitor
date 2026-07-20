import { Badge } from "@/components/ui/Badge";

const SEVERITY_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  Low: "info",
  Medium: "warning",
  High: "danger",
  Critical: "danger",
};

export function SeverityBadge({ severity }: { severity: string }) {
  return <Badge tone={SEVERITY_TONE[severity] ?? "neutral"}>{severity === "Critical" ? "Critical" : severity}</Badge>;
}

const ISSUE_STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  Open: "warning",
  Confirmed: "info",
  Resolved: "success",
  Ignored: "neutral",
  FalsePositive: "neutral",
};

const ISSUE_STATUS_LABEL: Record<string, string> = {
  Open: "Open",
  Confirmed: "Confirmed",
  Resolved: "Resolved",
  Ignored: "Ignored",
  FalsePositive: "False Positive",
};

export function IssueStatusBadge({ status }: { status: string }) {
  return <Badge tone={ISSUE_STATUS_TONE[status] ?? "neutral"}>{ISSUE_STATUS_LABEL[status] ?? status}</Badge>;
}

const SCAN_STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  Pending: "neutral",
  Queued: "neutral",
  Running: "info",
  Completed: "success",
  PartiallyCompleted: "warning",
  Failed: "danger",
  Cancelled: "neutral",
};

export function ScanStatusBadge({ status }: { status: string }) {
  return <Badge tone={SCAN_STATUS_TONE[status] ?? "neutral"}>{status}</Badge>;
}

const CATEGORY_LABEL: Record<string, string> = {
  Complexity: "Complexity",
  Duplication: "Duplication",
  DeadCode: "Dead Code",
  UnusedVariable: "Unused Variable",
  UnusedFunction: "Unused Function",
  CodingStandard: "Coding Standard",
};

export function CategoryBadge({ category }: { category: string }) {
  return <Badge tone="neutral">{CATEGORY_LABEL[category] ?? category}</Badge>;
}

export function QualityScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <Badge tone="neutral">-</Badge>;
  const tone = score >= 80 ? "success" : score >= 60 ? "warning" : "danger";
  return <Badge tone={tone}>{score}</Badge>;
}
