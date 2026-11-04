// Shared types for the Overview dashboard's drag-and-drop / resizable widget system and its
// per-user, multi-layout persistence (DashboardLayouts table). The widget catalog itself
// (WIDGET_DEFINITIONS) lives in src/components/dashboard/widgetCatalog.tsx since it needs JSX;
// this file holds the plain data shapes both the server (API routes) and client (grid, dialog)
// import.

export type WidgetSize = "small" | "medium" | "large" | "full";

// 12-column grid spans. "small"/"medium"/"large" are user-facing size choices; "full" always
// spans the whole row regardless of viewport, matching the "no widget should span full width
// unless it needs to" spirit while still giving charts/tables a real full-width option.
export const WIDGET_SIZE_SPAN: Record<WidgetSize, number> = {
  small: 3,
  medium: 6,
  large: 9,
  full: 12,
};

export const WIDGET_SIZE_LABEL: Record<WidgetSize, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  full: "Full Width",
};

// The eleven modules the Manage Widgets dialog groups by, plus "dashboard" for the
// general-purpose widgets (Quick Stats, Activity Feed, Notifications, etc.) that don't belong
// to any single feature module.
export type WidgetModule =
  | "dashboard"
  | "userManagement"
  | "securityCenter"
  | "networkManagement"
  | "remoteAccess"
  | "itAssetManagement"
  | "browserActivity"
  | "websiteManagement"
  | "websiteApiMonitoring"
  | "automation"
  | "administration";

export const WIDGET_MODULE_LABEL: Record<WidgetModule, string> = {
  dashboard: "Dashboard",
  userManagement: "User Management",
  securityCenter: "Security Center",
  networkManagement: "Network Management",
  remoteAccess: "Remote Access",
  itAssetManagement: "IT Asset Management",
  browserActivity: "Browser Activity",
  websiteManagement: "Website Management",
  websiteApiMonitoring: "Website & API Monitoring",
  automation: "Automation",
  administration: "Administration",
};

export const WIDGET_MODULE_ORDER: WidgetModule[] = [
  "dashboard",
  "userManagement",
  "securityCenter",
  "networkManagement",
  "remoteAccess",
  "itAssetManagement",
  "browserActivity",
  "websiteManagement",
  "websiteApiMonitoring",
  "automation",
  "administration",
];

// Per-widget entry in a saved layout: id references a WidgetDefinition.id (see widgetCatalog.tsx).
export interface LayoutWidgetState {
  id: string;
  size: WidgetSize;
  enabled: boolean;
}

export interface DashboardLayoutContent {
  widgets: LayoutWidgetState[];
}

export interface DashboardLayoutSummary {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardLayoutFull extends DashboardLayoutSummary {
  content: DashboardLayoutContent;
  refreshIntervalSeconds: number;
}

export const REFRESH_INTERVAL_OPTIONS: { label: string; seconds: number }[] = [
  { label: "30 seconds", seconds: 30 },
  { label: "1 minute", seconds: 60 },
  { label: "5 minutes", seconds: 300 },
  { label: "15 minutes", seconds: 900 },
];

export const DEFAULT_REFRESH_INTERVAL_SECONDS = 900;

export type TimeRange = "24h" | "7d" | "30d";

export const TIME_RANGE_LABEL: Record<TimeRange, string> = {
  "24h": "24 Hours",
  "7d": "7 Days",
  "30d": "30 Days",
};

export const TIME_RANGE_HOURS: Record<TimeRange, number> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
};

export const DEFAULT_TIME_RANGE: TimeRange = "24h";
