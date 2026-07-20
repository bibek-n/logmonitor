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

// Laravel Security's 9 issue categories (see CK_LaravelSecurityIssues_Category in
// scripts/migrate-laravel-security.ts) - unlike Code Quality's CategoryBadge (which renders
// every category in a flat neutral tone), each category here gets its own fixed accent color so
// the 9-way split reads at a glance across the dashboard, issues table, and scan detail tabs.
// Kept local to this module (not added to the shared Badge component's tone system, which only
// has 5 slots) rather than touching Badge.tsx and affecting every other module.
const CATEGORY_LABEL: Record<string, string> = {
  AppDebug: "App Debug",
  AppKey: "App Key",
  DotEnv: ".env",
  Csrf: "CSRF",
  MassAssignment: "Mass Assignment",
  Validation: "Validation",
  Sanitization: "Sanitization",
  StorageLinks: "Storage Links",
  Queue: "Queue",
};

const CATEGORY_COLOR: Record<string, string> = {
  AppDebug: "#ef4444",
  AppKey: "#f97316",
  DotEnv: "#eab308",
  Csrf: "#8b5cf6",
  MassAssignment: "#ec4899",
  Validation: "#06b6d4",
  Sanitization: "#10b981",
  StorageLinks: "#6366f1",
  Queue: "#64748b",
};

export function CategoryBadge({ category }: { category: string }) {
  const color = CATEGORY_COLOR[category] ?? "var(--ink-muted)";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 16%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
      {CATEGORY_LABEL[category] ?? category}
    </span>
  );
}

export function SecurityScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <Badge tone="neutral">-</Badge>;
  const tone = score >= 80 ? "success" : score >= 60 ? "warning" : "danger";
  return <Badge tone={tone}>{score}</Badge>;
}
