// Shared status -> Badge tone mapping across every IT Asset Logsheet list/detail view, matching
// the spec's fixed color scheme: green=compliant/completed, orange=due soon/pending,
// red=overdue/failed/critical/unsupported, blue=scheduled/informational, grey=inactive/retired/na.
export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

export const ASSET_STATUS_TONE: Record<string, BadgeTone> = {
  Active: "success",
  Inactive: "neutral",
  UnderMaintenance: "warning",
  Retired: "neutral",
  Disposed: "neutral",
  Lost: "danger",
  Spare: "info",
};

export const CRITICALITY_TONE: Record<string, BadgeTone> = {
  Critical: "danger",
  High: "warning",
  Medium: "info",
  Low: "neutral",
};

export const PASSWORD_STATUS_TONE: Record<string, BadgeTone> = {
  Current: "success",
  DueSoon: "warning",
  DueToday: "warning",
  Overdue: "danger",
  NotConfigured: "neutral",
};

export const PATCH_SEVERITY_TONE: Record<string, BadgeTone> = {
  Critical: "danger",
  High: "warning",
  Medium: "info",
  Low: "neutral",
  Informational: "neutral",
};

export const INSTALLATION_STATUS_TONE: Record<string, BadgeTone> = {
  Planned: "info",
  Scheduled: "info",
  InProgress: "warning",
  Installed: "success",
  Failed: "danger",
  RolledBack: "danger",
  Deferred: "neutral",
  NotApplicable: "neutral",
};

export const SOFTWARE_STATUS_TONE: Record<string, BadgeTone> = {
  Installed: "success",
  UpdateRequired: "warning",
  Unsupported: "danger",
  Unlicensed: "danger",
  Approved: "success",
  Unapproved: "warning",
  Removed: "neutral",
};

export const MAINTENANCE_STATUS_TONE: Record<string, BadgeTone> = {
  Planned: "info",
  Scheduled: "info",
  InProgress: "warning",
  Completed: "success",
  Failed: "danger",
  Cancelled: "neutral",
  Deferred: "neutral",
};

export function humanize(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}
