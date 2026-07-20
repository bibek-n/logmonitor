export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

export const TEST_CASE_STATUS_TONE: Record<string, BadgeTone> = {
  Draft: "neutral",
  Ready: "info",
  Approved: "success",
  Deprecated: "warning",
  Archived: "neutral",
};

export const TEST_SUITE_STATUS_TONE: Record<string, BadgeTone> = {
  Active: "success",
  Archived: "neutral",
};

export const TEST_RUN_STATUS_TONE: Record<string, BadgeTone> = {
  Planned: "neutral",
  "In Progress": "info",
  Paused: "warning",
  Completed: "success",
  Cancelled: "danger",
};

export const EXECUTION_RESULT_TONE: Record<string, BadgeTone> = {
  Passed: "success",
  Failed: "danger",
  Blocked: "warning",
  Skipped: "neutral",
  "Not Run": "neutral",
};

export const BUG_STATUS_TONE: Record<string, BadgeTone> = {
  New: "info",
  Open: "danger",
  "In Progress": "warning",
  Resolved: "success",
  "Ready for Retest": "info",
  Verified: "success",
  Closed: "neutral",
  Rejected: "neutral",
  Duplicate: "neutral",
  Reopened: "danger",
};

export const PRIORITY_TONE: Record<string, BadgeTone> = {
  Low: "neutral",
  Medium: "info",
  High: "warning",
  Critical: "danger",
};

export function toneFor(map: Record<string, BadgeTone>, value: string): BadgeTone {
  return map[value] ?? "neutral";
}
